---
title: "SpoofLab: When a Pulse Is Not Proof of Live Presence"
published: false
tags: devchallenge, presagechallenge
---

*This is a draft submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04/).*

<!-- LOCAL DRAFT. Public repository review, publication consent, live demonstration video and final readiness checks remain pending. Do not publish unchanged. Generated using scripts/render-post.cjs and reviewed aggregate evidence/summary.json. -->

## What I Built

SpoofLab is a Windows desktop workbench for developers who need to inspect the assumptions they place around camera-derived physiological measurements. It uses Presage SmartSpectra to display live pulse and breathing, retain quality diagnostics, and compare live, static-photo, screen-replay and injected-replay conditions.

The product distinguishes an SDK measurement, an experimental application decision, and evidence of live presence. Recorded video can contain physiological signals; the SDK explicitly supports recorded inputs. Measuring a pulse in a recording is expected behavior, not a vulnerability in the sensor.

The four screens cover capture, trust boundaries, evidence and a local Model Lab. Each trial retains its declared settings, validation messages, completion state and limitations. The useful output is a reproducible evidence report that includes unsuccessful attempts.

## Demo

**Video recording and hosted URL are pending.** The plan in `docs/DEMO_VIDEO.md` calls for actual live Presage readings with changing values, a visible blink prompt, a labeled replay and the Trust Boundaries screen. Historical evidence and any time compression will be labeled. Faces, source footage and physiological data will appear only with specific permission for public use.

## Code

[Source and setup instructions](https://github.com/Pritam-mb/presige). Public access and a clean release history still require review before submission. Raw participant evidence is excluded from the intended public release.

```powershell
npm ci
npm start
```

Use your own Presage key and a supported camera. Select the camera, attest processing consent, and run the camera-only FPS diagnostic before spending SDK credits. Negotiated camera settings do not prove delivered FPS. A pending readiness check is not a successful measurement.

## How It Responds to Human Signals

Live pulse drives the chart. Breathing is displayed separately. The existing experimental pulse policy requires stable, plausible output with acceptable confidence and validation for an uninterrupted interval after warm-up. A separately enabled random blink prompt checks observed eye transitions during its response window. Neither rule establishes secure authentication or resistance to adaptive video synthesis.

QualityGate-v1 is a distinct measurement-quality assessment with frozen criteria. Its acceptance counts below must not be substituted for the original pulse-plus-blink policy's decisions. Missing quality evidence and technical failures remain visible.

### Evidence, including failures

The reviewed aggregate contains **{{summary.total_trials}} unique trial attempts**, including **{{summary.inconclusive_count}} inconclusive measurements**. Duplicate exports are not counted as new trials.

{{aggregate_table}}

QualityGate acceptance is not proof of live presence. The acceptance denominator includes all attempts in each condition, including inconclusive measurements. The Wilson intervals describe these observed proportions; they do not account for repeated participants or dependent recordings. No significance or population-accuracy claim is made.

{{pulse_table}}

These are means of available trial means, not a comparison against physiological ground truth. The number of available trial means can include an interrupted trial that emitted estimates before stopping; it is not the number of independently validated measurements. No equivalence threshold was preregistered. Display flicker, compression, movement, lighting and SDK validation warnings can explain differences.

The individual replay observations illustrate the distinction between a quality/pulse gate and an application prompt. A replay can satisfy a pulse rule and fail a blink prompt, while a spontaneous recorded blink could match by chance. The small experiment does not establish reliable replay detection. Conditions marked not collected are explicitly unfinished work.

### Local ML that exposes its limits

The Model Lab offers logistic regression by default for training-data exploration. It says nothing about new sessions. Per-trial scores and log-odds contributions explain the fitted model; they do not establish causality, identity or liveness. The shuffled-label control fits the same logistic model to randomly permuted training labels and compares fitted-label agreement, illustrating why training fit is not an independent test. No held-out accuracy figure is claimed for this dataset.

XGBoost, when explicitly enabled, is an optional model-capacity/overfitting demonstration. Strict grouped evaluation remains separate and refuses to report independent performance when the dataset lacks suitable groups and class coverage. The source person and condition are confounded in some recordings, so a condition classifier could learn acquisition or participant differences rather than a general physiological property.

## Prize Categories

**Best Thoughtful Real-World Use.** SpoofLab helps developers inspect decisions built around human-sensing signals. It combines explicit consent, retained failure evidence, frozen policies and understandable explanations. Prize suitability is a judgment, not a guarantee.

## Consent and Data Handling

Camera/file processing starts only after consent. Permission to store measurements or train locally is separate from permission to publish faces, source footage, raw traces or physiological results. Written consent records stay outside the public repository. Permission for a local YouTube replay experiment is not treated as public-demo permission.

The app records no video or audio. Its desktop trial store retains measurements, timestamps, quality diagnostics, notes and grouping metadata locally under `data/trials` until **Clear all** deletes those records. Separately exported reports, local ML outputs and source recordings must be deleted separately. There is no automatic upload or app analytics. Public release is limited to reviewed source and aggregate tables; raw trial series and identifying metadata stay outside the release.

The optional `.env` key stays on disk until removed; it is excluded from Git. An in-app password field and the SDK hold it in memory during use. No key is included in exported trial reports. Local ML requires its separate dataset-consent attestation and uses no cloud AI service or external LLM.

The SDK is configured with `enableTelemetry: false`. Presage states: “Telemetry does not attach raw video/image frames or measured physiological values.” [SDK Telemetry and Privacy](https://smartspectra.presagetech.com/docs/telemetry-and-privacy). That statement describes telemetry, not every authenticated SDK operation. Disabling telemetry does not establish fully offline processing. Presage's documented authentication and data-handling policies still apply.

Imported evidence is unauthenticated. AI assistance was used during development. The project makes no medical diagnosis, treatment, production security or verified deepfake-detection claim.
