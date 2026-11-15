# ML Add-on: Capture-Channel Classifier and the Leakage Demo

## Verdict on the "SpoofLab AI" proposal

It is useful but oversized. Keep the idea of a model that is **honestly shown to fail**, and cut the rest.

| Proposed | Decision | Reason |
|---|---|---|
| Trainable signal classifier | **Keep, small** | Logistic regression on a handful of window features |
| XGBoost, SHAP, FastAPI | **Cut** | A second runtime and heavy tools for a dataset of about a dozen trials. Gradient boosting only if there are far more independent trials |
| AI failure explainer | **Keep, deterministic** | Show the misclassified trials and which feature moved. No LLM writes conclusions |
| Intelligent test generator | **Cut** | Not needed for the experiment |
| AI research report (LLM) | **Optional, off by default** | Only reads `summary.json`, runs locally, and is disclosed. It never invents or changes numbers |
| "AI detects fake humans" framing | **Never use** | A faithful replay can carry the same information as the original, so no classifier can infer the physical source from these inputs |

## What the model is, honestly

A **capture-channel classifier**: given 12-second windows of SDK output, does the capture look like a live camera or like a replay? It learns *channel quality* (stability, confidence, error rate), not presence. The interesting result is how much of its apparent skill disappears under honest evaluation.

## The contribution: a leakage demonstration

Cut every 90 s trial into non-overlapping 12-second windows. That gives many samples per trial, but windows from the same trial are near-duplicates.

1. **Ungrouped cross-validation** puts windows from the same trial into both training and test sets, so the score is inflated by memorizing the trial.
2. **Grouped cross-validation** keeps each trial entirely in train or test, so the score is honest.
3. Report both numbers side by side, plus a **permutation test** (labels shuffled at the trial level). If the gap is large and the honest score is near chance, that is the finding.

This needs little data, which is why it is realistic here. It is a lesson for developers, not a security claim.

## Go/no-go rule (decide at the end of Nov 18)

Run the ML add-on only if all are true:

- Harness gate G3 passes (real trial matrix complete).
- The app exports an optional per-second `series` in each trial: `bpm` (null when absent), `conf`, `stable` (0 or 1), `err` (0 or 1). No images.
- At least **6 independent conclusive trials** (not repeated windows), both classes present, and at least 8 windows per class.
- You have at most **one day** to spend. If not, skip it and say so in the post: "ML analysis was out of scope."

The script exits with code 2 and prints `NO-GO` if the data is too thin. Respect it.

## Leakage rules (the harness checks these)

- **Exclude** from features: condition, source kind, recording ID, file paths, camera pipeline and delivered FPS (they directly reveal the label).
- `leak_features` in the results file must be an empty list.
- Fixed seed, grouped evaluation, and both AUC values must be present or the results file is rejected.

## Reporting rules

- Report **grouped AUC first**, then ungrouped as the cautionary comparison, the number of trials, the permutation p-value, and the features used.
- Do not report accuracy as a property of the SDK or call the model a detector of deepfakes, spoofing or liveness.
- Show the failures: which replay trials were scored as live and why (compare their feature values with live trials).
- State the limits: one subject, one camera, one room, and a handful of trials.

## Optional LLM summary

Off by default. If enabled, use a local model, give it only `summary.json` and `evidence/ml/results.json`, forbid it from computing or changing numbers, and disclose it in the consent and data-handling section. If the SDK offers a built-in LLM or insights feature that sends derived measurements off the device, **keep it disabled** and mention it in the disclosure. Verify what exists in the SDK docs before writing that sentence.

## Harness addition (add to `scripts/harness.cjs`)

```js
// G7 ML (soft unless evidence/ml/results.json exists, then hard)
(function () {
  if (!exists('evidence/ml/results.json')) return add('G7.1', 'ML add-on not used (allowed)', false, true);
  let r = null; try { r = JSON.parse(read('evidence/ml/results.json')); } catch (e) {}
  add('G7.1', 'ML results are real, grouped, leak-free, and report both AUCs', true,
      !!r && r.synthetic === false && Array.isArray(r.leak_features) && r.leak_features.length === 0 &&
      r.n_groups >= 6 && typeof r.grouped_auc === 'number' && typeof r.ungrouped_auc === 'number' && typeof r.seed === 'number');
})();
```

## `ml/leakage_demo.py`

Tested end to end on test-only data (in a temp folder, then deleted), including the NO-GO path. Requires `numpy` and `scikit-learn`. Run with `python ml/leakage_demo.py` from the repo root.

```python
"""Capture-channel classifier + leakage demo. Reads evidence/real/trials/*.json (needs the optional `series` field).
Writes evidence/ml/results.json. Run: python ml/leakage_demo.py
Label = live camera (1) vs replay-like (0: screen_replay, injected_replay). Photos are excluded. This is NOT a liveness detector."""
import json, glob, os, sys
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import GroupKFold, StratifiedKFold
from sklearn.metrics import roc_auc_score

SEED, WIN, STEP = 7, 12, 12          # 12 s non-overlapping windows
FEATURES = ["stable_frac", "mean_conf", "bpm_sd", "bpm_range", "err_rate"]   # no condition, source, fps, path, id
rng = np.random.default_rng(SEED)

def windows(t):
    s = t["series"]                  # per-second lists: bpm (null if none), conf, stable (0/1), err (0/1)
    start = t["protocol"]["pulse_warmup_s"]; out = []
    for a in range(start, len(s["bpm"]) - WIN + 1, STEP):
        bpm = [b for b in s["bpm"][a:a+WIN] if b]; conf = s["conf"][a:a+WIN]; st = s["stable"][a:a+WIN]; er = s["err"][a:a+WIN]
        out.append([np.mean(st), np.mean(conf), np.std(bpm) if len(bpm) > 1 else 0.0, (max(bpm) - min(bpm)) if bpm else 0.0, np.mean(er)])
    return out

X, y, g = [], [], []
for i, f in enumerate(sorted(glob.glob("evidence/real/trials/*.json"))):
    t = json.load(open(f))
    if t.get("synthetic") is not False or "series" not in t or t["condition"] == "photo" or t["outcome"] == "inconclusive": continue
    for w in windows(t):
        X.append(w); y.append(1 if t["condition"] == "live" else 0); g.append(i)
X, y, g = np.array(X), np.array(y), np.array(g)
n_groups = len(set(g))
if n_groups < 6 or len(set(y)) < 2 or min(np.bincount(y)) < 8:
    print(f"NO-GO: need >= 6 independent trials, both classes, >= 8 windows per class (have groups={n_groups}, windows={len(y)})"); sys.exit(2)

def auc_cv(splitter, groups=None):
    p = np.zeros(len(y))
    for tr, te in splitter.split(X, y, groups):
        m = make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=1000, random_state=SEED)).fit(X[tr], y[tr]); p[te] = m.predict_proba(X[te])[:, 1]
    return roc_auc_score(y, p)

k = min(5, n_groups)
ungrouped = auc_cv(StratifiedKFold(5, shuffle=True, random_state=SEED))
grouped = auc_cv(GroupKFold(k), g)
perm = []                            # permute labels at TRIAL level, then keep the grouped evaluation
trial_ids = np.array(sorted(set(g))); lab = {tid: y[g == tid][0] for tid in trial_ids}
for _ in range(200):
    sh = dict(zip(trial_ids, rng.permutation([lab[t] for t in trial_ids]))); y_orig = y.copy()
    y = np.array([sh[t] for t in g]);
    try: perm.append(auc_cv(GroupKFold(k), g))
    except ValueError: pass
    y = y_orig
res = {"synthetic": False, "label": "live camera vs replay-like capture", "features": FEATURES, "leak_features": [], "seed": SEED,
       "n_groups": int(n_groups), "n_windows": int(len(y)), "ungrouped_auc": round(float(ungrouped), 3), "grouped_auc": round(float(grouped), 3),
       "permutation_p": round(float((np.sum(np.array(perm) >= grouped) + 1) / (len(perm) + 1)), 3) if perm else None}
os.makedirs("evidence/ml", exist_ok=True); json.dump(res, open("evidence/ml/results.json", "w"), indent=2); print(json.dumps(res, indent=2))
```