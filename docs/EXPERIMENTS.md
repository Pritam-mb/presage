# Experiment protocol and interpretation

The controlling scope is `SPOOFLAB_MASTER_HANDOFF.md`. Frozen future policy definitions are in `protocols/frozen-v1.json`. The protected reference files `02_WORKFLOW_AND_HARNESS.md` and `04_ML_ADDON_SPEC.md` were not supplied at this documentation update; their code has not been reconstructed or silently replaced.

## Capture protocol

Use 90-second trials by default, excluding the first 12 seconds from pulse analysis and the first 30 seconds from breathing analysis. Do not rely on HRV. Fix camera, pipeline, lighting and distance as far as practical; document deviations. A negotiated camera mode is not evidence of delivered FPS. Run the real six-second diagnostic before camera capture and retain its numeric result.

Keep processing and source consent explicit. New trials will carry `scenario` and `camera.pipeline`; historical records must not acquire guessed values. Keep the input source outside policy functions. Never duplicate frames or invent timestamps to meet a frame-rate threshold.

## Conditions

| Condition | Planned minimum attempts | Purpose |
| --- | ---: | --- |
| Live | 3 | Consenting live comparison |
| Printed photo | 2 | Static presentation behavior |
| Screen replay | 3 | Display and recapture behavior |
| Injected replay | 3 | Recorded input without the display/recapture path |

These are a small case-study matrix, not a sample-size justification. Preserve incomplete trials, technical failures and absent signals. Repeated exports are deduplicated by trial ID. Multiple plays of one clip remain related observations, not new independent recordings or participants. Compare the same consenting recording across screen and injected conditions when possible.

## Frozen policy comparisons

`pulse-only-v1` requires at least ten post-warm-up pulse estimates. `quality-gated-v1` additionally requires stable fraction at least 0.5 and validation-error frames no greater than 20%. `pulse-plus-blink-v1` adds a fresh randomized challenge actually issued during that trial. Without an issued challenge it is not evaluable. New decisions use `pass`, `fail` or `abstain` with a trace of consumed metrics, missing fields, frozen thresholds and reasons.

Legacy pulse-policy outputs and QualityGate outputs are different decisions. Do not pool them under the same name or relabel historical records as new-engine traces without evaluating them. A policy pass is a measured outcome under that rule, not authenticated presence. A technical failure is not a successful security rejection.

## Analyses

**A1 — same-person SDK-output agreement:** establish actual live/replay recording relationships first. With fewer than five genuine pairs, show individual pairs and state that agreement cannot be estimated. Five or more pairs may support a descriptive Bland–Altman plot and limits of agreement. Pooled estimates from adjacent trials are not a substitute for genuine pairs or ground truth. Use “agreement between two SDK outputs,” never a measurement-accuracy claim.

**A2 — recorded-blink simulation:** only if saved blink event timestamps support it, simulate 1,000 random prompt draws over replay timelines for windows of 5, 10 and 15 seconds and required counts of 1, 2 and 3. Label simulation distinctly from observed live hits, latency, false rejects and replay outcomes. Investigate possible over-counting in the one-requested/six-observed case. If timelines are unavailable, document the cut instead of inventing events.

The master schedules one evidence top-up session of at most 90 minutes: five live blink-on trials, three replay blink-on trials, one additional same-person live/replay pair and two second-lighting trials. Keep failures and stop to address camera issues rather than extending the session or weakening checks.

## Reports

Show trial counts next to proportions. Wilson intervals describe observed pass proportions and do not remove participant/recording dependence. Distinguish technical incompleteness, no usable signal, policy failure and abstention. Post numbers must come from the generated aggregate/analysis files through tokens. No outcome is manufactured to satisfy a gate.
