# Submission preparation

Working title: **SpoofLab — Break the Assumptions, Not the Sensor**

Intended category: Best Thoughtful Real-World Use. Prize suitability is a judgment, not a guarantee. This file is a checklist; no submission is published automatically.

## Before claiming completion

- [ ] Install dependencies and retain the generated lockfile.
- [ ] Build and launch the actual Electron SDK integration on Windows.
- [ ] Confirm cardio and optional facial entitlement.
- [ ] Run live baseline and replay trials with consent.
- [ ] Export genuine evidence and document exact sample sizes, settings and failures.
- [ ] Review current official challenge rules, submission deadline and published entries.
- [ ] Publish source without keys, participant recordings or personal reports.
- [ ] Include setup instructions, a demo video, and Consent and Data Handling.

## Demo outline

1. Explain the distinction between a physiological measurement and a trust decision.
2. Show consent, frozen policy and an actual live SmartSpectra trial.
3. Show screen and digital replay from the same recording, including any failures.
4. Inspect the trust-boundary screen; the verifier never sees the source label.
5. Compare counts and export the evidence. Explain uncertainty and confounds.

Use recorded SDK output only when clearly labeled as replay. Do not substitute the synthetic test fixtures for real findings. Do not state that tests prove camera compatibility, SDK accuracy, or secure authentication.

## Consent and Data Handling draft

SpoofLab requires consent before live capture or recorded-file processing. The application does not record video or audio. SDK telemetry is explicitly disabled; SDK authentication and runtime network requirements still apply. Desktop trial measurements and metadata are automatically stored locally in data/trials/ and restored at startup. Clear all deletes that store; separately exported files, camera diagnostics and analysis artifacts require separate deletion. A key saved in .env persists there until removed. Reports contain physiological values, timestamps, confidence/stability, validation/error logs, notes, consent attestations and source metadata. Operators are responsible for participant consent, sharing scope and deleting exported reports and separately recorded source files. SmartSpectra can automatically send derived pulse, breathing and heart-rate variability measurements with session metadata to Presage for forwarding to an LLM. SDK telemetry is disabled separately. Model Lab trains locally. The SDK can use an external AI service for automatic Insights during measurement. Imported evidence is unauthenticated. This experiment makes no medical or production security claims.


## Manual attestations ? not yet signed

- [ ] M1: second-person consent screen and data-handling review; reviewer/date pending.
- [ ] M2: official privacy page quotation, URL and read date reviewed by operator.
- [ ] M3: finished demo watched; changing live SDK values visible. Do not set video_shows_live_signal before this.
- [ ] M4: originality re-scan within 48 hours of submission; actual findings/date pending.
- [ ] M5: token-derived post checked against three generated summary values; reviewer/date pending.

Submission is deferred. No public URLs, publication consent or manual sign-off have been fabricated.
