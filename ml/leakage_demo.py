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
