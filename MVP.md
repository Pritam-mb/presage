# SpoofLab — Evidence-first MVP

## Reproducible training and legacy restoration repair - November 15, 2026

Investigated the reported 7/50 control instead of treating it as an accuracy result. Reproduced exactly: the old desktop loader accepted only 22 report-envelope files, skipping five valid legacy direct-trial files; that subset yielded 11 eligible trials and 7/50 under the previous input-order-dependent trainer. Original files remained present. The repaired loader restores all 27 with zero issues, validates both formats, preserves consent/import flags, reports corrupt/conflicting copies and does not rewrite files during load.

Training now sorts eligible trials by trial ID before fixed-seed fitting/permutation and emits a labeled-feature fingerprint. Identical input records must produce the same control regardless of import/restore order. Verified restored-store and consolidated-reference inputs yield identical fingerprints, 13 eligible records and 20/50. This supersedes the old 21/50 snapshot and the partial-restore 7/50 run. Model hyperparameters, labels and frozen physiological policies were not tuned to change the count. The control remains training-fit exploration, not an accuracy or significance estimate.

Regenerated local derived exploratory/strict reports, summary and unpublished draft. User should close/reopen the desktop app, confirm 27 restored/zero unreadable, then retrain exploratory mode or import the latest saved report. Inspect model errors and feature contributions and export the full snapshot. No new captures are needed. Original trial files and recordings were not edited by these checks.


Verified local state: 46 Node tests, 12 Python tests, build/syntax, browser workflows and real desktop-to-Python ML checks pass. Working-stage hard gates pass. Captured evidence remains unchanged; exploratory fits are available while strict independent performance is intentionally withheld. Manual submission reviews/video/publication remain deferred. See PROGRESS.md and docs/NEXT_STEPS.md.

Current ML refinement: matches the updates' capture-condition classifier scope. Real exploratory fitting remains available on 13 eligible records with a 21/50 shuffled-control headline, explanations and optional XGBoost inspection. Strict mode explicitly withholds grouped performance because only two of four connected groups contain both classes; matched-groups-v2 adds an operational audit, not scientific validation. Policy thresholds and raw evidence are unchanged. Mode-specific reports stay in memory when switching; current app instructions are docs/NEXT_STEPS.md. No additional captures are required for the present descriptive product. Submission is deferred.


## Authorized harness correction and licensing - November 15, 2026

Owner authorized the proposed choices. Added MIT LICENSE for source only. Original reference code remains archived unchanged; the active amended runner is scripts/harness-runtime.cjs, documented in docs/HARNESS_AMENDMENTS.md. Schema/consent/identifier validation retains all historical attempts; three low/unknown-FPS live attempts are reported as quality-limited. They cannot satisfy the successful live baseline, which still needs saved delivered FPS >=25, >=60 seconds and signal output. The separate >=25 FPS / >=6-second real diagnostic and every frozen measurement-policy threshold remain unchanged. No real trial was edited or removed.

Product-claim scanning now distinguishes engineering diagnostics from diagnosis and audits product text rather than executable tests or supplied developer examples. Prohibited medical/security/liveness claims still fail. Added tests for prohibited claims, absent/low FPS and non-mutating audits. Added final-only checks for actual M1-M5 sign-offs and a completed originality review within 48 hours, so placeholders cannot establish final readiness. Publication and consent have not been signed or performed.

Working-stage hard gates now pass with the separate source repository selected. Final submission remains deferred: real URLs/video, publication permissions, manual reviews and final-window originality review are outstanding. No additional recordings are needed to repair historical validation failures. Source-only copy and G10 are refreshed separately; nothing is pushed.


Latest v3 integration: reference files now found as docs/harness.md and docs/addon_spec.md. Active harness preserves supplied checks and adds G7?G10. A1/A2 outputs and 81 saved policy traces generated; Evidence Report cards and dynamic Model Lab control headline implemented. 43 tests, build/syntax and browser workflow pass. A1 has zero confirmed recording pairs (same-person comparisons remain descriptive); A2 is conditional simulation over four timelines. Optional leakage demo is NO-GO without required series. The token-built POST.md remains unpublished. Original trial evidence unchanged.

Remaining hard gates need resolution: license choice, protected all-historical-live >=25 FPS check versus keeping failed attempts, and claim-scanner false positives. No protected thresholds or word lists changed. Public consent/manual reviews/video are deferred. Do not call final readiness complete.


## Current controlling MVP ? November 15, 2026

SPOOFLAB_MASTER_HANDOFF.md controls current work; older sections below are historical. Implemented: capture/evidence/local ML plus three frozen source-blind policies and Policy Arena (05), saved-trial hidden-condition evaluation/reveal, live preset preparation and automatic post-capture policy evaluation, decision-trace export and descriptive scoreboard with Wilson intervals. New captures include scenario/camera.pipeline fields. Policy output is pass/fail/abstain; it does not establish input provenance or human presence.

A separate source-only review repository exists at D:/prestige-public; its independent G10 audit passes, with no remote or publication. Source-only preparation excludes secrets, private evidence and old history. Privacy/threat-model/experiments/ML-limitations/originality docs exist. Current automated checks: 34 Node tests, syntax, build and browser arena workflows pass.

Still incomplete: exact protected-reference harness reconciliation (02/04 files missing), license selection, paired/challenge analyses or documented cuts, remaining report/ML presentation polish, manual privacy reviews and real demo. Existing evidence is unchanged; exploratory ML is training-only, not validated performance. Submission is deferred per user instruction. This supersedes older memory-only, eight-trial and missing-live-evidence descriptions below.

Status: expanded application implemented; real-data validation and submission evidence remain in progress. November 15 updates.md is the latest requested scope; see PROGRESS.md for gaps and next steps.

Finishing controls implemented: 50 shuffled-label LR fits, training-only ML display without accuracy figures, optional XGBoost demonstration, fresh camera FPS gating with automatic diagnostic saving, separate replay/photo permission, named readiness gates and summary-token-driven draft post. Code verification passes; final readiness remains blocked by real capture and publication evidence. See HARNESS_STATUS.md and docs/NEXT_STEPS.md.

ML milestone: both models have now been fitted to the eight eligible real trials in a distinct exploratory training-only mode. Model Lab exposes mode selection and additive prediction explanations. This is not unseen-session validation; the original grouped evaluator remains unchanged and insufficient for these data. The eight-trial descriptive/session report is also available. See docs/ML.md and evidence/analysis/exploratory-fit.json.

Current scope: capture and camera diagnostics, trust/evidence views, optional blink prompt, local Model Lab with grouped logistic regression/XGBoost evaluation and explanations. Default capture is now 90 seconds. New sanitized v2 evidence export and QualityGate-v1 are separate from legacy trial reports. A final evidence harness is being implemented; a submission-ready result has not been established. User-reported live success must be verified from exported evidence, including FPS warnings.

Implementation update: the expanded three-screen application now includes an experimental pulse policy, optional blink check, import and HTML/CSV/JSON exports. See README.md for current behavior and verification status. The scope below preserves the original Day 1 baseline; real experimental findings remain unverified.

## Purpose

Help developers observe the difference between physiological measurements and proof of live presence. SmartSpectra supports recorded measurements; finding pulse in a recording is expected behavior, not a vulnerability in the SDK.

## Day 1 deliverable

A Windows Electron app that runs a 60-second live-camera or recorded-video trial, displays actual SmartSpectra pulse and breathing estimates, and exports comparable JSON evidence. No simulated measurements or invented findings.

## Essential workflow

1. Enter a Presage API key, held in memory only.
2. Choose live baseline, printed photograph, screen replay, or digitally injected replay. Photograph and screen conditions use the webcam; digital replay uses a user-selected video stream.
3. Consent before camera access or recording processing.
4. Start a fresh 60-second trial. Show preview, elapsed time, validation messages, pulse rate and breathing rate.
5. Stop automatically or manually. Preserve technical errors and early termination in the report.
6. Review the trial ledger and export metrics, validation events, protocol settings and summaries as JSON. Clear in-memory results when finished.

## Measurement protocol

- Protocol: `signal-availability-v1`.
- Exclude the initial 12 seconds from the pulse summary.
- Record actual values, SDK timestamps, confidence and stability when emitted.
- Report `signal_observed` when a completed trial contains post-warm-up pulse estimates; this is availability, not quality or liveness.
- Report missing output, early termination and technical failures as `inconclusive`.
- No accept/reject security verdict in this MVP.
- Keep condition labels as experimental metadata, never input to a future verifier.
- Use the same recording for screen and injected replay; record lighting and hardware separately in experiment notes.

## Privacy

SDK telemetry disabled explicitly. No app video recording, automatic disk storage, analytics or AI services. API key stays in memory. SDK network/authentication requirements still apply. Reports contain sensitive physiological metrics; users explicitly export them and must delete their exported copies themselves. Use only consenting subjects and recordings.

## Included engineering

Electron SDK bridge, renderer-safe protobuf decoding, camera/replay lifecycle cleanup, bounded trials, validation/error logging, source-independent measurement summary, JSON export and protocol unit tests.

## Excluded

Authentication, production security claims, deepfake detection, challenge-response, medical interpretation, cloud accounts, dashboards beyond the trial ledger, automated attack generation, and animation export.

## Go/no-go by November 14, 2026

- [ ] Live cardio outputs work with the available key and webcam.
- [ ] A consenting recorded clip produces usable SDK output.
- [ ] Identical measurement handling evaluates every source.
- [ ] A nontrivial failure mode or useful reproducible developer workflow is demonstrated.
- [ ] Findings can be communicated without presenting SDK file support as a security flaw.

Choose SpoofLab as the final submission only if evidence supports its usefulness. Otherwise switch to BioMotion Studio, reusing capture and timestamp handling to produce exportable breathing animation clips.

## Verification and completion limits

Run protocol tests and build the renderer. Live SDK behavior requires a valid API key, cardio access, camera permission and a real on-device trial; do not mark these verified from unit tests. No claim of competition originality without a fresh review of published entries.
