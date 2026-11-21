# Privacy and data handling

Reviewed against the app and the official SDK telemetry page on **November 15, 2026 (IST)**. This document describes the local application; it does not certify ownership, participant consent or any public release.

## Camera and recording consent

The operator confirms processing consent before the camera or a selected recording is processed. Camera permission is also required by the operating system. A visible preview and capture status identify active processing. New photo/replay trials require a separate attestation that the operator has permission to use that source in the local experiment.

Processing consent, local dataset consent and public-use permission are distinct. The user has confirmed local project/training permission for the mother, sister's photograph and the YouTube source. Those statements do not establish permission to publish their faces, recordings or physiological series. Keep written permission records outside the public repository. Use approved aggregate descriptions when public-use permission is absent. The app cannot independently verify an attestation.

## What SpoofLab stores

- SpoofLab records no video, images or audio. Separately prepared recordings remain the operator's responsibility.
- Completed and failed trial measurements, timestamps, confidence/stability, validation events, errors, notes and dataset grouping are saved locally in `data/trials/` and restored at startup.
- The six-second camera check saves numeric diagnostic evidence, not frames. Selected hardware identifiers must stay in memory; review any legacy source metadata before sharing.
- Raw evidence, physiological series and derived ML artifacts remain private. No report is automatically uploaded.
- An API key entered in the password field remains in the process; a key in `.env` remains in that file until the operator removes it. Do not show, log, share or commit it.

**Clear all** deletes the app's saved trial store and clears the ledger. It does not delete separately exported reports, camera diagnostic files, source recordings or derived analysis/ML files. Delete those copies separately when they are no longer needed. Removing dataset consent excludes the trial from future dataset exports; it does not erase files already exported or results already derived. Closing the app releases capture resources.

## SDK telemetry and network boundaries

Presage states: **“Telemetry does not attach raw video/image frames or measured physiological values.”** [Official SDK Telemetry & Privacy page](https://smartspectra.presagetech.com/docs/telemetry-and-privacy), read November 15, 2026.

SpoofLab sets `enableTelemetry: false`. The cited statement is about telemetry, not every SDK operation. It does not establish that all processing is offline or that there are no authenticated runtime requests. Consult the SDK's current documentation and applicable policies for its full behavior. Do not describe diagnostics as anonymous: Presage explains that authenticated requests can be associated with an account and that enabled readiness diagnostics can contain identifying technical context. Its documented retention rules must not be replaced by an invented expiration period.

## Local ML

Model Lab uses a local Python process. It requires separate dataset consent, sends no dataset to an external LLM service, and does not train automatically merely because a trial was captured. Training inputs retain only fields required for measurements, declared labels and grouping. Feature predictors exclude participant/source labels. Group identifiers still require careful handling even when they are aliases.

## Publication boundary

Publish source through a fresh, audited repository history. Keep `data/trials/`, `evidence/real/`, `.env`, recordings, artifacts and per-second series outside it. Review aggregate releases separately; a small aggregate can still reveal information about a participant. A Git ignore rule does not remove files from existing commits. Public-use permission and a completed human review are required before a demo or post includes a person's face or data.

## Automatic SDK Insights

SmartSpectra can automatically send derived pulse, breathing and heart-rate variability measurements with session metadata to Presage for forwarding to an LLM. SDK telemetry is disabled separately. Presage describes on-device measurement and excludes raw imagery from the Insights payload. SpoofLab makes no on-demand Insights requests. We have not measured network traffic from past sessions. [Presage Insights privacy notice](https://smartspectra.presagetech.com/docs/llm-insights/) Documentation checked November 20, 2026. Explain this processing to participants before starting a new SDK trial.
