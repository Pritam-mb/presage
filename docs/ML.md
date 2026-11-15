# Local Model Lab

Current reproducibility repair: the desktop loader now accepts both legacy direct-trial files and report envelopes through the same validation. It restores all 27 existing trials without rewriting them. The earlier envelope-only subset reproduced the reported 7/50 on 11 eligible trials. Training now canonicalizes trial order and emits a labeled-feature fingerprint. Restored and reference inputs produce identical controls: current 20/50 on 13 eligible trials. This supersedes earlier snapshot counts; none is an accuracy estimate. Restart the app and retrain or import the current report. Reversing the same input order is regression-tested to leave fitted outputs and the control unchanged.


Updated November 15, 2026. Model Lab is an experimental classifier of capture conditions, **not a liveness verifier**, authentication system or deepfake detector. The master updates explicitly keep ML as a way to inspect what a small dataset supports and where its models fail.

## Two distinct modes

| Mode | What it does | What the output supports |
| --- | --- | --- |
| Exploratory fit - training data only | Fits logistic regression and the optional XGBoost inspection to eligible consented trials; explains predictions on those same records | Inspection of fitting behavior and influential measurements; no new-session performance claim |
| Strict grouped holdout | Checks independent evidence and fixed class-balanced group folds before fitting/evaluating | A limited held-out experimental report only if its evidence requirements pass; no proof of physical presence |

Exploratory mode needs at least two eligible trials of each class. It remains available when strict mode is withheld. Logistic regression is the default view. XGBoost is an explicitly optional fitting/overfitting demonstration, not a model to tune until the small dataset looks impressive.

Every exploratory report declares: **Training-data exploration. It says nothing about new sessions.** Exploratory JSON and the UI omit aggregate accuracy, Brier and calibration figures. Per-trial uncalibrated scores, model errors, additive feature contributions and training provenance remain available. Contributions explain the fitted model, not a physiological cause.

The trainer fits 50 additional logistic models to shuffled row labels while preserving class counts, with seed 42. It reports how many shuffled-label training fits match or exceed the real-label training fit. This illustrates fitting flexibility; row shuffling does not preserve participant dependence, so it is not a group-aware significance test.

## Current saved artifacts

The November 15 exploratory artifact, `evidence/analysis/exploratory-fit.json`, contains 13 eligible trials. Its observed shuffled-label headline is 21 of 50. The UI reads the imported/generated artifact instead of assuming these dated values. Earlier eight-trial and 32-of-50 descriptions are historical and must not be substituted for the current report.

The strict independent-evidence audit requires at least 12 eligible trials, four connected groups, and at least four connected groups containing both live and non-live measurements. Each fixed training/test fold must contain both classes. These are conservative operational requirements, not a statistical validation guarantee. In the present data, four connected groups exist but only two contain both classes; strict mode withholds independent-performance claims. It does not silently discard the single-class sources or disable exploratory fitting.

Connected groups link declared participant, session and recording aliases and non-empty source recording hashes. Links through excluded records also count: excluding a low-quality bridge cannot hide shared provenance. Changing aliases or repeating a clip cannot create independence. Source kind, condition, paths and grouping labels are excluded from feature predictors.

For stronger future evidence, collect live and replay conditions within genuinely independent consenting groups, retain exact recording relationships and fix evaluation rules before examining the new results. Do not tune on held-out predictions. More participants or captures are not required to demonstrate the current descriptive case study.

## Train and inspect

In Electron, open **04 Model Lab**, select exploratory mode and press **Train locally (uses consented trials)**. The app prepares a compact input from current complete metadata and explicit dataset consent, then runs Python locally. Import a saved evaluation JSON instead when inspecting an existing run. Export the full JSON to retain predictions, feature contributions and split provenance.

The local environment is `.venv/Scripts/python.exe`. The desktop bridge uses it when present unless `SPOOFLAB_PYTHON` explicitly selects another interpreter. A typical offline run is:

```powershell
.\.venv\Scripts\python.exe ml/train.py evidence/analysis/consented-ml-dataset.json --mode exploratory --output evidence/analysis/exploratory-fit.json
```

For strict evaluation, change `--mode exploratory` to `--mode grouped` and use a different output such as `evidence/analysis/evaluation.json`. An insufficient-data report is an evidence result, not a reason to overwrite the exploratory artifact or rename sources.

The input schema is `spooflab-evidence-v2`; the output is `spooflab-ml-evaluation-v1`. Ineligible captures are listed with reasons and remain in the original evidence ledger. Missing data are not turned into successful attack rejections. Preprocessing is fitted on training records only; model scores are uncalibrated. Contributions use logistic coefficients or native TreeSHAP in log-odds units.

No model pickle, cloud dataset or external LLM is loaded. Models are fitted per run; the retained artifact contains results and explanations, not a deployed camera classifier. Research summaries and next-experiment suggestions are deterministic and local.

## Optional leakage demonstration

The supplied specification is present as `docs/addon_spec.md`, with its protected script at `ml/leakage_demo.py`. It compares trial-window grouped and ungrouped evaluations only if its separate go/no-go requirements are met. The current sanitized evidence lacks the required optional per-second `series`, so that script returns **NO-GO**. Do not invent a series, interpolate missing signals or weaken its checks to obtain an AUC.

That optional window experiment is separate from the implemented trial-level exploratory Model Lab. Its absence does not mean the existing models were not fitted. Keep physiological availability, frozen-policy decisions, exploratory predictions and independent model evaluation distinct.

See [NEXT_STEPS.md](NEXT_STEPS.md) for the app workflow and safe derived-report commands. Original capture data must not be hand-edited or regenerated merely to satisfy a gate.
