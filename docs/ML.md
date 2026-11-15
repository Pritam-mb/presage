# Local model evaluation

## Current exploration guardrails

Every exploratory report declares: **Training-data exploration. It says nothing about new sessions.** Logistic regression is shown by default; XGBoost is revealed only through the optional fitting/overfitting-demonstration checkbox. Exploratory JSON and the UI omit aggregate accuracy, Brier and calibration figures. Per-record model scores and additive explanations remain available, with their training provenance.

The trainer fits 50 additional logistic models to shuffled row labels, keeping the class counts fixed, seed 42. It reports how many shuffled-label training fits match/exceed the real-label fit, and the full distribution of matching-label counts. This is a diagnostic of training-fit flexibility, not a significance test; row shuffling does not preserve participant dependence. The current real dataset produced **32 of 50** shuffled-label fits matching the real-label training fit. One shuffle left all labels unchanged. This does not establish chance-adjusted accuracy or generalization.

## Exploratory mode with the current real dataset

Model Lab now offers **Exploratory fit — training data only** and **Strict grouped holdout — independent evaluation**. The strict mode retains its original rules. Exploratory mode fits both models on eligible consenting records and explains predictions on those same training records. It does not report unseen-session performance. It needs both classes, with at least two eligible trials per class.

The real exploratory report is `evidence/analysis/exploratory-fit.json`. Import it through Model Lab's evaluation JSON input, or fit again with the desktop Train button after selecting exploratory mode. All prediction rows, metric headings and the banner identify their training scope. Export the full JSON to retain explanations.

```powershell
.\.venv\Scripts\python.exe ml/train.py evidence/analysis/consolidated-dataset.json --mode exploratory --output evidence/analysis/exploratory-fit.json
```

Current run: eight eligible trials (five live, three replay), three connected groups. Logistic training behavior is inspected against the shuffled-label control; it is not presented as a generalization score. XGBoost returns a constant live-like score of 0.625 for all eight under the fixed conservative regularization, so it does not discriminate these inputs. Its three replay errors and zero feature effects are shown rather than hidden or tuned away. Parameters are reproducible in ml/train.py, seed 42. Models are fitted during each run; this release retains predictions/explanations, not a deployment model file or live classifier.

The existing participant-grouped evaluation still returns insufficient_data for this dataset. The session-evaluation report is descriptive and is separate from either ML mode.

Project Python: `.venv/Scripts/python.exe`. The desktop Train button automatically uses this environment when present (unless SPOOFLAB_PYTHON is explicitly set). This avoids the incompatible system NumPy/pyarrow installation discovered during the real-evidence audit.

Audit all exported and autosaved reports without changing originals:

```powershell
.\.venv\Scripts\python.exe scripts\audit-evidence.py
```

Outputs are under `evidence/analysis/`: deduplicated dataset, audit, grouping worksheet and evaluator report. Missing consent/grouping is reported, never filled automatically. Import `consolidated-dataset.json` into Evidence Report to restore all unique trials, then save real group aliases and dataset consent in Model Lab. The CSV worksheet is a reference; edit metadata in the app before training.

Use Model Lab to assign participant, session and recording aliases and separate explicit dataset consent. Export consented data or use Train locally in Electron. The trainer compares logistic regression and XGBoost with two fixed grouped folds and preprocessing fitted on training folds only. Feature contributions are additive log-odds (coefficients or native TreeSHAP). Scores are uncalibrated.

Operational minimum: 12 eligible completed trials, four independent connected groups, both classes in each training and test fold. Shared participant/session/recording aliases or recording hashes connect trials into one group. Renaming aliases must never be used to manufacture independence. A single participant's repeats cannot satisfy participant-held-out evaluation. These minima do not establish statistical validity.

Failed captures are excluded from training with reasons and retained in the evidence ledger. A printed photo with no pulse cannot serve as a completed feature-rich negative. No trained real-data model or performance claim exists until real eligible data is supplied.

The input is spooflab-evidence-v2 JSON. Output is spooflab-ml-evaluation-v1 JSON with exclusions, split provenance, model metrics, per-trial held-out predictions and feature contributions. Export full evaluation JSON to retain it. No model pickle or external AI service is involved. Research summaries and next-experiment suggestions are derived deterministically from the evaluation.

```powershell
python -m pip install -r ml/requirements.txt
python ml/train.py dataset.json --output evaluation.json
```

The November 15 updates pack describes an optional leakage-demo specification, but the referenced 04_ML_ADDON_SPEC.md was not supplied. Current grouped evaluation remains available; do not invent that absent specification.
