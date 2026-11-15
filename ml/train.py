"""Local exploratory model evaluation. No network calls, pickle loading or automatic storage."""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import sklearn
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import StandardScaler
import xgboost as xgb

FEATURES = ["pulse_coverage", "mean_pulse_confidence", "pulse_stable_fraction",
            "pulse_rate_mean", "pulse_rate_std", "breathing_coverage",
            "mean_breathing_rate", "mean_breathing_confidence", "validation_warning_fraction"]
CONDITIONS = {"live", "printed_photo", "screen_replay", "injected_replay"}
LIMITATIONS = [
    "Exploratory classifier of the supplied experimental dataset, not authentication or medical assessment.",
    "Probabilities are uncalibrated model scores. Brier and calibration bins describe held-out observations, not a calibrated deployment model.",
    "Recorded physiology may be indistinguishable from live physiology. Feature contributions explain this model, not physical causality.",
    "Connected groups prevent declared participant, session and recording overlap; incorrect or missing operator metadata can still conceal leakage.",
    "Quality exclusions are inconclusive, not successful attack rejections. Counts from a small dataset do not establish population accuracy.",
    "Models can learn camera, lighting, confidence and acquisition confounds. Repeat testing on independent devices and people is required.",
]


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def samples(trial, key, start):
    result = {}
    for s in trial.get(key, []):
        if not isinstance(s, dict):
            continue
        t, value = s.get("elapsedSec"), s.get("value")
        if finite(t) and finite(value) and start <= t < trial["durationSec"] and value > 0:
            result[t] = s  # Duplicate timestamps do not inflate sample counts.
    return [result[t] for t in sorted(result)]


def feature_vector(trial):
    """Allowlisted measurements only; labels/paths/IDs never enter this function's result."""
    duration = trial["durationSec"]
    pulse, breath = samples(trial, "samples", 12), samples(trial, "breathingSamples", 30)
    def mean(values):
        values = [v for v in values if finite(v)]
        return float(np.mean(values)) if values else np.nan
    def coverage(items, start):
        bins = max(0, math.floor(duration) - start)
        return len({math.floor(s["elapsedSec"]) for s in items if math.floor(s["elapsedSec"]) < math.floor(duration)}) / bins if bins else 0.0
    events = sorted([e for e in trial.get("validationEvents", []) if isinstance(e, dict) and finite(e.get("elapsedSec")) and isinstance(e.get("code"), int)], key=lambda e: e["elapsedSec"])
    code, warned, known, cursor = None, 0, 0, 0
    for second in range(12, math.floor(duration)):
        while cursor < len(events) and events[cursor]["elapsedSec"] <= second:
            code = events[cursor]["code"]; cursor += 1
        if code is not None:
            known += 1; warned += code != 0
    stable = [s["stable"] for s in pulse if isinstance(s.get("stable"), bool)]
    return [coverage(pulse, 12), mean([s.get("confidence") for s in pulse]),
            float(np.mean(stable)) if stable else np.nan,
            mean([s["value"] for s in pulse]), float(np.std([s["value"] for s in pulse])) if pulse else np.nan,
            coverage(breath, 30), mean([s["value"] for s in breath]), mean([s.get("confidence") for s in breath]),
            warned / known if known else np.nan]


def eligibility(t):
    reasons = []
    ml = t.get("ml") if isinstance(t.get("ml"), dict) else {}
    if ml.get("datasetConsent") is not True:
        reasons.append("No explicit dataset consent")
    if any(not isinstance(ml.get(k), str) or not ml[k].strip() for k in ("participantId", "sessionId", "recordingGroupId")):
        reasons.append("Missing participant/session/recording group identifier")
    if t.get("condition") not in CONDITIONS:
        reasons.append("Unknown condition")
    duration = t.get("durationSec")
    prescribed = t.get("protocol", {}).get("durationSec", 60)
    if not finite(duration) or not 45 <= duration <= 180 or not finite(prescribed) or duration < prescribed - 0.25 or t.get("endReason") != "completed":
        reasons.append("Incomplete or invalid duration")
    if t.get("errors"):
        reasons.append("Technical errors recorded")
    if not reasons:
        pulse = samples(t, "samples", 12)
        if len({math.floor(s["elapsedSec"]) for s in pulse}) < 5:
            reasons.append("Fewer than five post-warm-up seconds with pulse data")
        if not any(finite(s.get("confidence")) and isinstance(s.get("stable"), bool) for s in pulse):
            reasons.append("Pulse quality fields missing")
    return reasons


def connected_groups(trials):
    parents = list(range(len(trials)))
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]; i = parents[i]
        return i
    seen = {}
    for i, t in enumerate(trials):
        ml = t.get("ml") if isinstance(t.get("ml"), dict) else {}
        tokens = [(k, str(ml.get(k, "")).strip()) for k in ("participantId", "sessionId", "recordingGroupId")]
        source = t.get("source") if isinstance(t.get("source"), dict) else {}
        tokens.append(("sha256", str(source.get("sha256") or "").strip().lower()))
        for token in tokens:
            if not token[1]: continue
            if token in seen: parents[find(i)] = find(seen[token])
            else: seen[token] = i
    members = {}
    for i, t in enumerate(trials): members.setdefault(find(i), []).append(t["trialId"])
    names = {root: "group-" + hashlib.sha256("\n".join(sorted(ids)).encode()).hexdigest()[:12] for root, ids in members.items()}
    return [names[find(i)] for i in range(len(trials))]


def metrics(predictions):
    y = np.array([p["label"] for p in predictions]); prob = np.array([p["probability"] for p in predictions]); pred = prob >= .5
    bins = []
    for lower in [0, .2, .4, .6, .8]:
        upper = round(lower + .2, 1); mask = (prob >= lower) & ((prob <= upper) if upper == 1 else (prob < upper))
        bins.append(dict(lower=lower, upper=upper, count=int(mask.sum()), meanProbability=float(prob[mask].mean()) if mask.any() else None,
                         observedLiveFraction=float(y[mask].mean()) if mask.any() else None))
    return dict(evaluatedTrials=len(y), falseLive=int(((y == 0) & pred).sum()), missedLive=int(((y == 1) & ~pred).sum()),
                correct=int((pred == y).sum()), accuracy=float((pred == y).mean()), brier=float(brier_score_loss(y, prob)), calibration=bins)


def independence_audit(groups, labels):
    """A conservative project readiness rule, not proof of statistical validity.

    A connected group is declared provenance, not an independently verified
    participant. Count eligible classes within groups; never remove a pure
    group just to make a balanced-looking evaluation dataset.
    """
    classes = collections.defaultdict(set)
    for group, label in zip(groups, labels):
        classes[str(group)].add(int(label))
    mixed = sum(values == {0, 1} for values in classes.values())
    live_only = sum(values == {1} for values in classes.values())
    non_live_only = sum(values == {0} for values in classes.values())
    return dict(version="matched-groups-v2", status="ready" if mixed >= 4 else "insufficient", minimumMixedGroups=4,
                mixedGroups=mixed, singleClassGroups=live_only + non_live_only, totalGroups=len(classes),
                liveOnlyGroups=live_only, nonLiveOnlyGroups=non_live_only,
                eligibleLiveTrials=int(np.sum(labels == 1)), eligibleNonLiveTrials=int(np.sum(labels == 0)),
                readyForGroupedComparison=mixed >= 4,
                interpretation="Operational readiness requires four declared connected groups with both live and non-live eligible trials. This reduces class/group confounding; it does not establish matched acquisition, independent provenance, generalization or liveness.")


def evaluate_report(data, mode="grouped"):
    if mode not in ("grouped", "exploratory"):
        raise ValueError("Unknown training mode")
    if not isinstance(data, dict) or data.get("schema") != "spooflab-evidence-v2" or not isinstance(data.get("trials"), list):
        raise ValueError("Expected a spooflab-evidence-v2 report")
    if len(data["trials"]) > 300:
        raise ValueError("At most 300 trials are supported")
    trials, excluded, ids = [], [], set()
    for t in data["trials"]:
        if not isinstance(t, dict) or not isinstance(t.get("trialId"), str) or t["trialId"] in ids:
            raise ValueError("Invalid or duplicate trial ID")
        ids.add(t["trialId"])
        for key in ("samples", "breathingSamples", "validationEvents", "errors"):
            if not isinstance(t.get(key), list) or len(t[key]) > 40000: raise ValueError(f"Invalid {key} array")
        reasons = eligibility(t)
        if reasons: excluded.append(dict(trialId=t["trialId"], reasons=reasons))
        else: trials.append(t)
    # Link through excluded records too: removing a low-quality bridge must not conceal shared provenance.
    all_groups = dict(zip([t["trialId"] for t in data["trials"]], connected_groups(data["trials"])))
    groups = np.array([all_groups[t["trialId"]] for t in trials]); y = np.array([int(t["condition"] == "live") for t in trials])
    audit = independence_audit(groups, y)
    result = dict(schema="spooflab-ml-evaluation-v1", status="insufficient_data", generatedAt=datetime.now(timezone.utc).isoformat(),
                  featureNames=FEATURES, featureVersion="time-bins-v1", probabilityCalibration="uncalibrated", decisionThreshold=.5,
                  dataset=dict(totalTrials=len(data["trials"]), eligibleTrials=len(trials), excluded=excluded, independentGroups=len(set(groups)), independentEvidenceAudit=audit),
                  splits=[], models=[], recommendations=[], narrative="", limitations=LIMITATIONS,
                  software=dict(numpy=np.__version__, sklearn=sklearn.__version__, xgboost=xgb.__version__), seed=42)
    def insufficient(message):
        result["narrative"] = message
        result["recommendations"] = ["Collect completed, consenting measurements from independent participant/recording groups with both live and non-live conditions.",
                                     "Resolve camera FPS and technical failures before collecting training data. Never relabel failed measurements as non-live successes."]
        return result
    exploratory = mode == "exploratory"
    result["evaluationMode"] = "training_only" if exploratory else "grouped_holdout"
    if exploratory and (len(trials) < 4 or len(set(y)) < 2 or min(collections.Counter(y).values(), default=0) < 2):
        return insufficient("Exploratory fitting requires at least two eligible trials of each class. No independent evaluation is performed.")
    if not exploratory and (len(trials) < 12 or len(set(groups)) < 4 or len(set(y)) < 2):
        return insufficient("Training withheld: require at least 12 eligible trials, four independent connected groups and both classes. These are operational minima, not statistical validation.")
    if not exploratory and not audit["readyForGroupedComparison"]:
        report = insufficient(f"Independent evaluation withheld: only {audit['mixedGroups']} of {len(set(groups))} declared connected groups contain both live and non-live eligible trials; require at least four such groups under matched-groups-v2. Single-class groups can confound source/person with class. All eligible records remain counted. Exploratory fitting is still available and makes no generalization claim.")
        report["recommendations"] = [f"The independent-evidence protocol needs {4 - audit['mixedGroups']} more declared connected groups with eligible live and non-live conditions before grouped comparison. Repeated windows or renamed aliases do not establish new groups.",
                                     "No additional people are required to keep the present descriptive case study and exploratory training. Continue inspecting the existing fitted predictions and shuffled-label control.",
                                     "If collecting a larger independent study, document participant, acquisition and recording relationships before capture; matching class coverage alone is not statistical validation."]
        return report
    X = np.array([feature_vector(t) for t in trials], dtype=float)
    folds = [(np.arange(len(trials)), np.arange(len(trials)))] if exploratory else list(StratifiedGroupKFold(n_splits=2, shuffle=True, random_state=42).split(X, y, groups))
    if any(len(set(y[a])) < 2 or len(set(y[b])) < 2 for a, b in folds):
        return insufficient("Training withheld: fixed grouped folds do not contain both classes. Collect a more balanced set of independent groups; no test-informed split search is performed.")
    predictions = {"Logistic regression": [], "XGBoost": []}
    for fold, (train, test) in enumerate(folds):
        if not exploratory:
            assert not set(groups[train]) & set(groups[test])
        result["splits"].append(dict(fold=fold, trainTrialIds=[trials[i]["trialId"] for i in train], testTrialIds=[] if exploratory else [trials[i]["trialId"] for i in test],
                                     trainGroups=sorted(set(groups[train])), testGroups=[] if exploratory else sorted(set(groups[test]))))
        imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        a = imputer.fit_transform(X[train]); b = imputer.transform(X[test])
        scaler = StandardScaler(); a_scaled = scaler.fit_transform(a); b_scaled = scaler.transform(b)
        logistic = LogisticRegression(C=1.0, max_iter=1000, random_state=42).fit(a_scaled, y[train])
        tree = xgb.XGBClassifier(n_estimators=40, max_depth=2, learning_rate=.05, min_child_weight=2,
                                 subsample=1, colsample_bytree=1, eval_metric="logloss", random_state=42, n_jobs=1).fit(a, y[train])
        tree_contrib = tree.get_booster().predict(xgb.DMatrix(b), pred_contribs=True)
        outputs = [("Logistic regression", logistic.predict_proba(b_scaled)[:, 1], b_scaled * logistic.coef_[0], np.repeat(logistic.intercept_[0], len(test))),
                   ("XGBoost", tree.predict_proba(b)[:, 1], tree_contrib[:, :-1], tree_contrib[:, -1])]
        for name, probs, contributions, bases in outputs:
            for row, index in enumerate(test):
                p = float(probs[row]); t = trials[index]
                predictions[name].append(dict(trialId=t["trialId"], condition=t["condition"], label=int(y[index]), probability=p,
                    predictedLabel=int(p >= .5), correct=bool(int(p >= .5) == y[index]), fold=fold, sampleRole="training" if exploratory else "held_out", baseValue=float(bases[row]),
                    contributionUnits="log_odds", contributions=[dict(feature=f, value=float(X[index,j]) if np.isfinite(X[index,j]) else None,
                    contribution=float(contributions[row,j])) for j,f in enumerate(FEATURES)]))
    result["status"] = "exploratory_fitted" if exploratory else "evaluated"
    result["models"] = [dict(name=name, metrics=metrics(rows), predictions=rows,
        explanationMethod="Standardized coefficient × feature value" if name.startswith("Logistic") else "Native TreeSHAP (pred_contribs)") for name,rows in predictions.items()]
    result["narrative"] = "Two fixed grouped folds evaluated each eligible trial once, with preprocessing fitted only on its training fold. " + " ".join(
        f"{m['name']}: {m['metrics']['falseLive']} false-live and {m['metrics']['missedLive']} missed-live classifications among {m['metrics']['evaluatedTrials']} held-out trials; Brier {m['metrics']['brier']:.3f}." for m in result["models"])
    result["recommendations"] = ["Repeat the experiment with a new participant and recording group; do not tune on these held-out results.",
        "Compare the same consenting recording through screen and digital replay while holding acquisition conditions fixed."]
    failures = [p for m in result["models"] for p in m["predictions"] if p["label"] == 0 and p["predictedLabel"] == 1]
    if failures:
        conditions = sorted({p["condition"] for p in failures})
        result["recommendations"].insert(0, "Collect new independent trials for observed false-live conditions: " + ", ".join(conditions) + ".")
    if excluded: result["recommendations"].append(f"Review {len(excluded)} excluded trials; failures remain inconclusive rather than classifier negatives.")
    if exploratory:
        result["limitations"] = ["TRAINING DATA ONLY: every displayed prediction uses a trial the model was fitted on. There is no held-out test set or evidence of generalization."] + LIMITATIONS
        result["narrative"] = f"Exploratory fitting used {len(trials)} eligible real trials. Both models were fitted and explained on these same records. Counts and Brier values describe training fit only; they are not unseen-session accuracy."
        result["recommendations"] = ["Inspect which measured features drive each fitted prediction; contributions are not causal explanations.",
                                    "Use the existing live/replay case study as descriptive evidence. Keep grouped evaluation separate until independent data supports it."]
        for model in result["models"]:
            model["metrics"]["sampleRole"] = "training"
            model["metrics"]["trainingTrials"] = len(trials)
            scores = [p["probability"] for p in model["predictions"]]
            model["constantScore"] = max(scores) - min(scores) < 1e-8
            if model["constantScore"]:
                message = f"{model['name']} produces identical scores for every training record; it does not distinguish conditions under the current regularization and data size."
                result["narrative"] += " " + message
                result["recommendations"].append(message)
        # A training-fit control only: row-label shuffling preserves class counts,
        # not participant exchangeability. It is not a permutation significance test.
        rng = np.random.default_rng(42)
        real_matches = sum(p["correct"] for p in result["models"][0]["predictions"])
        counts = []
        unchanged = 0
        for _ in range(50):
            shuffled = rng.permutation(y)
            unchanged += int(np.array_equal(shuffled, y))
            control = LogisticRegression(C=1.0, max_iter=1000, random_state=42).fit(a_scaled, shuffled)
            counts.append(int(np.sum(control.predict(a_scaled) == shuffled)))
        result["shuffledLabelControl"] = dict(model="Logistic regression", runs=50, seed=42,
            trainingTrials=len(trials), realLabelMatches=int(real_matches), shuffledLabelMatches=counts,
            matchOrExceedReal=sum(n >= real_matches for n in counts), unchangedPermutations=unchanged,
            interpretation="Training-data exploration. It says nothing about new sessions. Labels are shuffled across trial rows with class counts fixed; this is not a significance test or a group-aware null model.")
        for model in result["models"]:
            for key in ("accuracy", "brier", "calibration"):
                model["metrics"].pop(key, None)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, nargs="?"); parser.add_argument("--stdin", action="store_true")
    parser.add_argument("--output", required=True)
    parser.add_argument("--mode", choices=["grouped", "exploratory"], default="grouped")
    args = parser.parse_args()
    if args.stdin == bool(args.input): parser.error("Provide either an input path or --stdin")
    output = None if args.output == "-" else Path(args.output)
    if args.input and output and args.input.resolve() == output.resolve(): parser.error("Output must differ from input")
    if args.input and args.input.stat().st_size > 25_000_000: parser.error("Input exceeds 25 MB")
    content = sys.stdin.read(25_000_001) if args.stdin else args.input.read_text(encoding="utf-8-sig")
    if len(content) > 25_000_000: parser.error("Input exceeds 25 MB")
    try:
        result = evaluate_report(json.loads(content), mode=args.mode)
    except (ValueError, TypeError, KeyError) as error:
        parser.error(str(error))
    serialized = json.dumps(result, indent=2, allow_nan=False)
    if output is None:
        print(serialized)
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(serialized, encoding="utf-8")
        print(f"{result['status']}: {result['dataset']['eligibleTrials']} eligible trials, {result['dataset']['independentGroups']} independent groups. Local report written.")


if __name__ == "__main__": main()
