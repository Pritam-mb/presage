# Experimental procedure

## Question

What happens when an application treats sustained physiological output as proof of live presence? Can a simple temporal prompt expose some limitations of that assumption? The SDK is a measurement tool and explicitly supports recorded input. Do not frame replay measurements as an SDK vulnerability.

## Preparation

1. Get consent for processing and for any separately recorded footage. Use your own face initially. Do not record bystanders.
2. Confirm cardio output from the live webcam before collecting attacks. Keep the camera stable, face forward and torso visible in even light. Avoid talking during the baseline.
3. Record a consenting clip in a separate camera app. SpoofLab itself does not record video. Use a clip at least five seconds longer than each trial.
4. Write down camera model, resolution, lighting, participant alias, replay display and distance. Keep the original recording and its SHA-256 fingerprint if consent permits.
5. Fix pulse limits, confidence threshold, sustained duration and challenge setting before evaluating inputs. Do not tune on the trials you report as evaluation data.

## Matrix

| Condition | Source | Purpose | Confounds |
| --- | --- | --- | --- |
| Live baseline | Webcam, consenting person | Establish live measurement functionality | Lighting, motion, framing, camera settings |
| Printed photograph | Webcam facing print | Static presentation behavior | Print size, glare, incidental motion |
| Screen replay | Webcam facing the recording on a display | Physical replay behavior | Display flicker, moiré, refresh rate, camera exposure |
| Digital replay | Same file as screen replay, supplied as video stream | Remove display/recapture effects | Codec, frame delivery, input provenance |

Use the same policy for every condition. Repeat the full matrix with the blink check on if available. Do not compare different settings as though only the input changed. Randomize trial order where practical; document changes and failures. Five repeats per condition can illustrate repeatability, not establish security accuracy. Check account usage before collecting trials.

## Timing and interpretation

The app uses a wall-clock trial interval beginning before `sdk.start()`. It aligns SDK sample times to the latest timestamp in the first packet's arrival and preserves both SDK timestamps and packet receipt times. This alignment is approximate, not a latency measurement; inspect raw timestamps if buffering or startup is unusual. Startup failures cannot count as completed trials. Pulse warm-up is fixed at 12 seconds; breathing rate has its own warm-up and does not decide the pulse policy.

The optional blink prompt is generated during the trial rather than at setup. It has only three targets. Stable facial transitions are counted after the prompt; stale/unstable detections do not count. A neutral eye-open observation must precede a rising blink edge. Too few facial observations or no neutral state produces `unavailable`, which is inconclusive. Mismatched observed counts fail the challenge. A prompt is not a trusted camera path, and cannot defend against adaptive real-time synthesis. Spontaneous blinking may match by chance. Do not ask participants to hold their breath or perform uncomfortable physiological maneuvers.

## Reporting

- Keep all attempted trials, including incomplete or erroneous ones.
- Preserve raw counts and exact settings. The comparison groups by policy and SDK version.
- Include SDK confidence and validation diagnostics; high confidence alone is not proof of accuracy or liveness.
- Export JSON alongside CSV/HTML. JSON retains per-sample evidence, raw errors and source metadata.
- Imports recompute summaries but are not signed, independently witnessed or authenticated. The application cannot verify operator-entered labels or consent claims.
- Never report missing readings as a security rejection. Do not claim population false-accept rates from one person's repeats.
- Qualify apparent screen/digital differences: flicker and recapture can explain them; they are not automatically evidence of replay detection.

## Go/no-go evidence

Do not tick these based on software tests:

- [ ] Live pulse works with the actual key and webcam.
- [ ] A consenting recorded clip produces output.
- [ ] The same source-independent rule is applied to all inputs.
- [ ] A useful reproducible developer workflow or nontrivial failure mode is demonstrated.
- [ ] Findings can be communicated without claiming the SDK is a liveness product.

If the only finding is that a recorded video retains physiology, its novelty is weak. Reconsider the submission direction rather than inventing a discovery.
