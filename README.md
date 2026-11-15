# SpoofLab — Break the assumptions, not the sensor

## Current finishing workflow

See [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) for the remaining human capture/permission tasks. `node scripts/harness.cjs` now writes `HARNESS_STATUS.md`; use `--final` for submission readiness, and review every blocked gate. The post is rendered from aggregates with `node scripts/render-post.cjs` and remains an unpublished draft. The official challenge requires a public repository and demo video showing a live Presage signal; source/test success alone is insufficient.

Exploratory Model Lab now includes 50 shuffled-label logistic fits, LR-only default display and an optional XGBoost fitting demonstration. No aggregate accuracy figures are shown for training-data exploration. Existing grouped evaluation remains separate. New six-second camera checks save numeric diagnostics to `evidence/real/camera_fps.json`; no image is stored. New replay/photo trials require a separate source-permission checkbox. Review the pending public-use permissions before showing any person's face, source recording or physiological series.

Presage states: “Telemetry does not attach raw video/image frames or measured physiological values.” ([official SDK telemetry documentation](https://smartspectra.presagetech.com/docs/telemetry-and-privacy)). This statement describes telemetry; it does not establish that all SDK requests are absent or fully offline. SpoofLab sets telemetry off and uses no external LLM. Diagnostic storage retention and authentication details remain governed by Presage's documented policies.

## Local trial autosave

The desktop app now automatically saves completed and failed trial metrics, notes and ML grouping/consent metadata in `data/trials/` inside the project. Saved trials restore on startup. No video is recorded, and the API key is excluded from saved trial reports. This folder is ignored by Git. **Clear all** deletes these local trial files and clears memory; separately exported reports remain until you delete them. ML training still needs explicit dataset consent. Browser preview remains temporary and requires explicit export. Earlier references below to memory-only retention describe the previous version; desktop autosave supersedes them.

**Resume next session:** [HANDOFF.md](HANDOFF.md) records today's progress and the current camera delivery blocker (November 12, 2026). Next investigation: phone-as-webcam options; successful live measurement is not yet established.

A Windows Electron laboratory for comparing live and replayed camera-derived physiology. Three screens separate capture, application trust assumptions, and reproducible evidence. SmartSpectra supports recorded measurements: pulse in a recording is expected behavior, not a vulnerability in the sensor.

## Start the report workspace now

No dependency installation, API key or camera needed:

```powershell
npm run preview
```

Open **http://127.0.0.1:4173**. Explore the interface or import a SpoofLab v2 JSON report. Browser preview disables capture and displays no synthetic signals. It listens only on the local machine and serves only public UI files.

## Run live capture on Windows

Requires Windows x64, Node.js 20.12+ (24 recommended), a webcam and a Presage key with cardio access. Enable face metrics access for the optional blink check.

You can paste the key into the root `.env` file as `PRESAGE_API_KEY=your_key_here`. Restart the Electron app to load it automatically into the password field. `.env` is ignored by Git and stores the key as plain text on your device; delete the value to remove this saved copy. The browser preview never receives it. An existing `PRESAGE_API_KEY` environment variable takes precedence.

```powershell
npm install
npm run check
npm test
npm start
```

The launcher removes `ELECTRON_RUN_AS_NODE` from the Electron child environment. `npm start` builds the renderer-safe SDK adapter before launching the app. Dependencies use `latest` for the first install; retain the generated package lock, then use `npm ci` for subsequent reproducible installs. An executable installer is not included; run from source.

1. Enter your API key in the password field. It stays in memory; do not put it in code or experiment notes.
2. Choose live baseline, printed photograph, screen replay, or digital replay.
3. Document lighting, camera and participant alias. Set the policy **before** testing.
4. Optionally enable the randomized blink check, then attest consent.
5. Start a 60-, 75- or 90-second trial. Stop & save retains incomplete evidence as inconclusive.
6. Inspect the Trust Boundaries and Evidence Report screens. Export JSON for the audit trail, CSV for analysis, and HTML for a standalone printable report.

For digital replay select a consenting MP4/WebM up to 500 MB and at least five seconds longer than the trial. The app fingerprints the file with SHA-256 and processes its video stream in real time. Audio tracks are removed. It never loops or seeks the source. Use the same clip for screen and digital replay. The file fingerprint identifies bytes, not authenticity.

## What is implemented

- Consent-gated live SDK capture and host-supplied video replay streams.
- Pulse and breathing rate display, pulse rate chart, breathing trace retention, confidence and validation logs.
- Source-independent experimental verifier with per-trial frozen settings and SDK version.
- Optional random 1–3 blink prompt, issued at 25 seconds with a 10-second response window. Stable false-to-true transitions count once; missing detection evidence is inconclusive.
- Comparison counts separated by condition, policy and SDK version. No success percentages or population accuracy claims.
- Per-trial inspection, confidence histograms, technical error logs and consent/source metadata.
- Validated JSON import with summary recomputation and duplicate ID skipping; imported data is marked unauthenticated.
- JSON, escaped standalone HTML and spreadsheet-safe CSV export.
- Bounded startup, cancellation, capture stop and resource cleanup.

## The two distinct results

**Signal availability:** `signal_observed` means a completed, error-free trial emitted pulse estimates after the initial 12 seconds. It is not a quality or live-presence verdict.

**Experimental application policy:** By default, requires 40–110 BPM, SDK confidence ≥40%, stable output and OK validation for five uninterrupted seconds after warm-up. Gaps over 1.5 seconds or intervening invalid validation break the interval. These are declared exploratory choices, not a security standard. Completed trials with sufficient quality-qualified evidence outside the interval are rejected; missing quality evidence, technical failures and incomplete trials are inconclusive. If enabled, the blink check must also pass.

The verifier does **not** inspect condition labels, filenames or source kinds. “Accepted” and “rejected” refer solely to this naive application rule, never an SDK liveness decision. A chance blink match can pass; this is not authentication or deepfake detection. Full limitations and experiment procedure: [docs/EXPERIMENT.md](docs/EXPERIMENT.md).

## Consent and data handling

Consent is required before processing. No app video/audio recording, browser local storage, analytics, cloud database or AI service is used. The desktop app automatically saves trial measurements, notes and metadata in `data/trials` and restores them after restart. A key entered in the app stays in memory; a key saved in `.env` remains on disk until you remove it. SDK telemetry is explicitly disabled; SDK authentication/runtime network requirements and SDK-managed behavior still apply. No claim of fully offline processing is made.

Explicit exports contain physiological values, timestamps, confidence, stability, notes, source filenames, file fingerprints, camera label/settings and consent attestations. Avoid names and identifiable notes. Clear all removes in-memory results and the desktop `data/trials` store. Forget API key clears the password input when no trial is active. Close the app to release the SDK and its in-memory state; saved trials persist until deleted. Users must delete exported files and source recordings separately.

## Real evidence audit (November 15, 2026)

Run `npm run audit:evidence` to validate and deduplicate the JSON exports directly under `evidence/`. Conflicting records with the same trial ID stop the audit. The command leaves originals unchanged and writes a local combined JSON, CSV, HTML report, per-trial QualityGate records and source hashes under ignored `evidence/real/`, plus `evidence/summary.json`.

The supplied exports contain 15 unique attempts: eight completed 90-second trials and seven interrupted attempts. Two completed screen replays satisfy the experimental application policy with blink off; one completed replay fails its enabled blink prompt. Separately, only one live and one screen replay pass QualityGate-v1. These are descriptive observations, not replay-detection accuracy or independent population evidence. No real model was trained: explicit dataset consent and grouping metadata are absent, and eight completed trials are below the 12-eligible-trial minimum.

See [next steps](docs/NEXT_STEPS.md), [local post draft](docs/DEV_POST.md) and [demo recording plan](docs/DEMO_VIDEO.md). The draft remains unpublished and the demo has not been recorded. The original raw exports are tracked in Git; review sharing permission before further publication.

## Verification status

- `npm test`: 23 passing Node tests, including duplicate/conflicting-export coverage (November 15 audit).
- `npm run check`: syntax and DOM reference checks pass.
- `npm run test:browser`: Chromium checks pass for report workflows, desktop/mobile layout and **synthetic** SDK completion/startup cancellation. Requires local Chrome/Edge, or `SPOOFLAB_BROWSER` pointing to Chromium. Test fixtures are explicitly synthetic, saved only under ignored `artifacts/`.
- Dependency installation and the real SDK adapter build now pass. SmartSpectra 3.5.0 native runtime loads successfully.
- `npm run test:desktop`: actual Electron startup, official preload bridge, real adapter loading and configured key presence pass. This test does not open the camera or start measurements.
- Real live and screen-replay exports have now been inspected as described above. Photo/digital-replay trials and standalone exported FPS evidence are still absent. Python test collection currently fails because global PyArrow requires NumPy >=2.0 while NumPy 1.26.4 is installed; optional Model Lab verification needs an isolated compatible environment.

Browser tests launch a separate headless profile with sandbox disabled for this restricted test environment; they do not open a camera or affect the normal Electron app's sandbox. The app retains `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`.

## Troubleshooting

- **npm EACCES fetching the registry:** check network permissions. The earlier restriction in this session was resolved; dependencies are now installed. Elevation is not assumed to solve a network restriction.
- **Cardio/auth error:** confirm your key and cardio entitlement with Presage. The app does not silently substitute synthetic or breathing-only data.
- **Low frame rate:** select Performance camera capture (640×480, requesting 30 FPS), improve lighting, close other camera apps and inspect delivered-frame diagnostics. Detail mode requests 1280×720. These are requested camera settings, not guaranteed frame rates or SDK accuracy. Background throttling is disabled for the Electron renderer. A sustained-low-FPS error ends the trial immediately as inconclusive; retry only with a fresh user-initiated trial.

Use **Check camera FPS / 6 seconds** with consent to measure negotiated FPS and actual presented-frame delivery without an API key or SDK session. This check opens the webcam but saves no images and creates no trial. Below 25 FPS here points to camera/driver/exposure or preview-delivery issues before SDK processing. If the preview reaches 25 FPS but SDK frame acknowledgements do not, investigate SDK/frame-transfer/CPU load. Preview delivery is a diagnostic, not a guaranteed measure of SDK throughput. SDK trials explicitly request a minimum of 25 FPS; unsupported camera modes fail without fabricating frames or changing timestamps.
- **No blink result:** confirm face access, remain centered, and inspect detection evidence. Intentional blinks may not be available or usable for everyone.

Blink detection must be enabled before starting. The prompt appears at 25 seconds; only stable blink transitions within that prompt's ten-second window count. A frame-rate failure is not evidence of a mismatched blink challenge.
- **Video ends early:** select a longer file. Interrupted playback is not a completed test.
- **SDK teardown times out:** close and restart the app before collecting another trial.

## Project map

```text
src/main.cjs          Electron window, SDK IPC bridge, camera permissions, train IPC handler
src/sdk-adapter.js    Bundled official renderer SDK and protobuf decoder
src/preload.cjs       Context bridge exposing SpoofMLBridge.train to the renderer
src/renderer.js       Capture lifecycle, four-screen workspace (capture/trust/evidence/ML)
src/camera.cjs        Consent-aware camera selector, device enumeration, FPS diagnostic
src/protocol.cjs      Source-independent policy and blink transitions
src/reports.cjs       Import, aggregation and export
src/ml-ui.js          Model Lab UI: metadata editor, dataset export, local train, evaluation inspector
src/ml.css            Model Lab stylesheet
src/ml-process.cjs    Local Python subprocess launcher (no cloud contact, strips API key from env)
ml/train.py           Grouped logistic regression + XGBoost evaluation, feature extraction
ml/test_pipeline.py   Python unit tests for the ML pipeline
ml/requirements.txt   numpy, scikit-learn, xgboost pinned versions
scripts/preview.cjs   Dependency-free local report workspace
test/                 Decision-rule and report tests
docs/                 Experiment guide and submission checklist
```

## Official references

- [Node/Electron SDK](https://smartspectra.presagetech.com/docs/nodejs)
- [Renderer API and input lifecycle](https://smartspectra.presagetech.com/docs/nodejs/api-reference)
- [Data types and confidence](https://smartspectra.presagetech.com/docs/data-types)
- [SDK telemetry and privacy](https://smartspectra.presagetech.com/docs/telemetry-and-privacy)

The original [MVP.md](MVP.md) preserves the initial experiment scope. This README describes the expanded implementation; it does not claim the research go/no-go checks have passed.
# presige


