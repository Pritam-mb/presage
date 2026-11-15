# SpoofLab

A Windows Electron laboratory for testing camera-derived physiology under live, photograph, screen-replay and injected-replay conditions. SmartSpectra supports recordings: pulse output from a recording is expected behavior, not an SDK vulnerability. SpoofLab is not a liveness verifier, authentication product or deepfake detector.

## Run locally

Use Windows x64, Node.js (24 recommended), a supported camera and a Presage key with cardio access. Facial metrics are needed for blink challenges.

```powershell
npm ci
npm start
```

Save your key as `PRESAGE_API_KEY=your_presage_key` in the project-root `.env`, or set that environment variable. An existing saved key loads into the desktop password field. Browser preview never receives it. Do not commit or display the key.

Report-only preview: `npm run preview`, then open http://127.0.0.1:4173. Preview allows local imports, with no SDK capture or invented readings.

## App workflow

- **01 Capture Laboratory:** confirm processing consent, select the actual camera and run the six-second FPS diagnostic. Default trials last 90 seconds. Pulse analysis starts after 12 seconds, breathing after 30. Camera trials require a fresh delivered-FPS result of at least 25; failed attempts stay in the ledger.
- **02 Trust Boundaries:** inspect physiological availability separately from the original experimental application decision.
- **03 Evidence Report:** review attempts, completed/incomplete durations, inconclusive outcomes, frozen-policy results and saved observations. Export JSON, CSV or HTML explicitly.
- **04 Model Lab:** train on consented saved trials, inspect the shuffled-label control, predictions and feature contributions. Strict evaluation separately checks independent evidence. Switching modes retains reports in memory.
- **05 Policy Arena:** choose a frozen policy, evaluate a saved trial, then reveal its declared condition. Live presets prepare normal consented capture. Traces show what the policy read. Pass/fail/abstain does not establish authenticated presence.

See [current operator steps](docs/NEXT_STEPS.md), [experiment protocol](docs/EXPERIMENTS.md) and [threat model](docs/THREAT_MODEL.md).

## Local ML setup

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml/requirements.txt
npm run test:ml
```

Desktop training and ML tests prefer the local environment; `SPOOFLAB_PYTHON` can specify another interpreter. No external AI service is used.

Exploratory mode fits logistic regression and optional XGBoost to the same records it explains. Its headline uses the actual shuffled-label control, not accuracy on new sessions. Scores are uncalibrated.

Strict `matched-groups-v2` requires four connected groups containing both eligible live and non-live observations, plus trial/class/fold checks. Meeting this operational minimum still does not establish reliable deployment performance. Unsupported strict evaluation returns `insufficient_data`; exploratory fitting remains available. This safeguard was added after reviewing the data, not preregistered as a scientific result.

The optional window-leakage experiment has separate data requirements and may return NO-GO. See [ML workflow](docs/ML.md) and [limitations](docs/ML_LIMITATIONS.md). Models are fitted per run; reports retain results and explanations, not a deployed live-camera classifier.

## Consent and Data Handling

Consent is required before processing. Dataset consent, recording-source permission and public-use permission are separate. Show only approved footage or aggregates in anything public.

- **Storage and retention:** desktop measurements, metadata and failures autosave in `data/trials/` and restore at startup until deleted. No app video, image or audio recording. Browser-preview reports stay in memory unless exported.
- **Deletion:** Clear all deletes the desktop trial store and clears reports in memory. Exported reports, numeric diagnostics, analysis artifacts and operator-created recordings remain until deleted separately. Revoking dataset consent excludes future exports; it cannot erase existing copies.
- **Sharing:** no automatic report uploads, cloud dataset, AI service or app analytics. Python ML runs locally. Review physiological exports before sharing.
- **SDK telemetry:** disabled explicitly. SDK authentication and runtime network behavior still apply.

Presage states: “Telemetry does not attach raw video/image frames or measured physiological values.” [Official telemetry page](https://smartspectra.presagetech.com/docs/telemetry-and-privacy), read November 15, 2026. This describes telemetry, not all SDK operations. See [PRIVACY.md](docs/PRIVACY.md).

## Verification

```powershell
npm run check
npm test
npm run build
npm run test:ml
npm run test:browser
npm run test:desktop
```

Browser tests use synthetic capture fixtures. Desktop checks open no camera; when local consented evidence exists, they exercise real Python training. Tests do not validate physiological accuracy or establish liveness.

With existing private evidence, generate derived outputs without rewriting original trials:

```powershell
npm run traces
npm run analyze
npm run summarize
npm run post
node scripts/harness.cjs --public-root D:\prestige-public
```

Use the actual source-only repository path if different. Original supplied code is archived in `scripts/reference/`. See [authorized audit amendments](docs/HARNESS_AMENDMENTS.md). Low-FPS attempts remain visible and cannot establish a qualified live baseline; frozen policy thresholds are unchanged.

Working hard gates passing does not establish submission readiness. Final mode needs real links, a live-signal video, manual reviews and a recent originality review. Publishing remains deferred.

## Source-only release boundary

Original development history contains private evidence and must not be published. `npm run source:prepare` creates an allowlisted review copy under ignored `artifacts/`, excluding trial data, populated `.env`, recordings and Git history. A separate source-only repository is maintained at `D:\prestige-public` with no remote. Audit it using `node scripts/g10-public-repo.cjs D:\prestige-public` before any future release. Local checks cannot establish publication consent or remote visibility.

Source is MIT licensed: [LICENSE](LICENSE). This grants no rights to participant data, third-party recordings or the SDK, which retain their own terms.


