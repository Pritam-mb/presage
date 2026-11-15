# What to do next in the local app

Updated November 15, 2026. Submission and publishing are deferred. You do not need to repeat completed captures or recruit more people to inspect the current descriptive project.

The controlling updates call SpoofLab a testing laboratory, **not a liveness verifier**. Model Lab learns patterns in the supplied capture conditions. A live-like score is an experimental classifier output; it cannot prove that someone is physically present.

## Use the existing work

1. Run `npm start` from `D:\prestige`. Desktop trial metrics restore automatically from `data/trials/`. No new camera trial is needed for the following steps.
2. Open **04 Model Lab**. Select **Exploratory fit - training data only** and press **Train locally (uses consented trials)**. This uses the existing complete group aliases and separate dataset consent. Do not invent new aliases or assume consent if a trial lacks them.
3. Read the shuffled-label control headline, then keep logistic regression selected. Inspect per-trial predictions, errors and feature contributions. These predictions use the same records used for fitting; they are not results on new sessions. The optional XGBoost view is a fitting/overfitting inspection.
4. If you prefer the saved run, import `evidence/analysis/exploratory-fit.json` in Model Lab instead. Export the full evaluation JSON to retain predictions and explanations.
5. Open **05 Policy Arena**. Choose a frozen policy and saved trial, evaluate it, read the decision trace, then reveal its declared condition. The policy receives measurements only. An unissued blink challenge is not evaluable; it is not an assumed pass or fail.
6. Open **03 Evidence Report**. Check attempts, completed/incomplete duration, original experimental outcomes and the separate frozen-policy table. Keep failed and inconclusive attempts visible. Completed duration does not mean measurements were quality-qualified.

After the legacy-loader repair, close/reopen the desktop app and confirm that it restores all 27 trials with zero unreadable files. The current canonical-order report uses 13 eligible trials and its control is 20 of 50. The earlier partial restoration produced 7 of 50 on 11 eligible trials; the earlier reference-order snapshot was 21 of 50. These counts describe different input/order snapshots, not accuracy. Current reports show an input fingerprint; compare that and eligible counts before comparing runs.

## What strict ML can and cannot do

Strict grouped mode is separate from exploratory fitting. Its independent-evidence audit requires the existing operational minimum of 12 eligible trials and four connected groups, plus at least four connected groups that each contain live and non-live observations. Both classes must also occur in each fixed training/test fold. Shared participant, session, recording or source-hash relationships connect trials before exclusions are applied.

The current data have four connected groups but only two with both classes. One-class sources can let a classifier learn person or acquisition differences instead of the intended comparison. Strict mode therefore withholds its independent-performance report. This does not remove exploratory training or its predictions and explanations. Changing a label, alias or model parameter to obtain a score would not fix the evidence.

For a future independent study, collect matched live/replay conditions in genuinely independent consenting groups and keep their provenance explicit. More repeats of one recording do not create more independent groups. No extra recording is required now to finish the current descriptive case study. The optional leakage-demo script has a separate NO-GO because its required per-second series are absent; it is not the existing Model Lab pipeline.

## Rebuild derived reports without rewriting captures

Use these commands only after the existing source dataset and consent metadata are correct:

```powershell
npm run traces
npm run analyze
npm run summarize
npm run post
node scripts/harness.cjs --public-root D:\prestige-public
```

These commands derive traces, analyses, aggregate results and an unpublished `docs/POST.md`. They do not create new real trials. Do not hand-edit `data/trials/` or `evidence/real/`, and do not rerun an older conversion/audit command to overwrite historical exports.

The A1 report keeps same-person descriptive comparisons separate from confirmed source-recording pairs. A2 is a simulation over saved SDK blink timelines, not measured replay resistance. Both retain their sample counts and limitations.

For offline local training with the already configured environment:

```powershell
.\.venv\Scripts\python.exe ml/train.py evidence/analysis/consented-ml-dataset.json --mode exploratory --output evidence/analysis/exploratory-fit.json
```

Use only a consented dataset. The desktop button is the simplest route when metadata changes because it prepares a compact current training input. No external AI service is contacted.

## If you choose to capture again

Use a consenting source, bright stable lighting and a fixed camera. Run the six-second camera check first; delivered FPS must reach at least 25. Requested or negotiated 30 FPS is not evidence of delivered FPS. New 90-second trials should retain scenario and camera-pipeline metadata, failures and technical warnings. Three new clean baselines, more photos and more injected replays are not current prerequisites merely because older documents requested them.

## Later publication work

The separate source-only repository passes its local privacy-history audit; the original working history must stay private. Local-use consent does not establish permission to show faces, recordings or physiological traces publicly. A demo showing actual changing live SDK values, public-use permission, manual reviews, a final-window originality check and real URLs remain future submission work. None has been signed or published automatically.
