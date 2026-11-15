# Live demonstration plan

Status: **not recorded or uploaded**. This plan is not evidence of a finished demonstration.

Target length: about three minutes. Use your own face/recording or a participant who specifically agreed to public video, face and physiological-data sharing. Keep written consent outside the public repository. Local ML consent or permission to test a YouTube clip is not assumed to cover publication. Use approved aggregate descriptions if footage-sharing permission is unavailable.

## Before recording

- Refresh evidence and draft: `node scripts/audit-evidence.cjs`, `node scripts/summarize.cjs`, `node scripts/render-post.cjs`.
- Read `HARNESS_STATUS.md`; do not conceal remaining missing matrix or camera checks.
- Hide the API-key area and identifying filenames/notes. Do not expose `.env`, raw traces or another person's physiological values without permission.
- Ensure the selected camera meets actual delivery requirements. Keep the live capture window and real SDK values visible.
- Label historical evidence, cuts and any accelerated segment. Keep the original take. Do not replace an unsuccessful fresh capture with unlabeled historical output.

## Sequence

| Approximate segment | Show | Explain |
| --- | --- | --- |
| Opening | Capture Lab and project purpose | The app inspects application assumptions around physiological measurements. |
| Live capture | Consent, selected camera, frozen settings, changing pulse/breathing and actual trial timer | This is a real live SmartSpectra trial. Measurements and application decisions are separate. Use a clearly labeled speed-up only if needed. |
| Blink prompt | Actual on-screen instruction and observed transitions | The prompt is an experimental freshness check; show its real pass, mismatch or inconclusive outcome. |
| Replay | A permitted replay or clearly labeled historical result | The same recorded clip may satisfy a pulse rule yet fail a particular blink prompt. This is an individual observation, not a replay-detection accuracy claim. |
| Trust Boundaries | Sensor output, application policy and decision explanation | Quality acceptance does not prove a live person is present. Missing data and technical failures stay inconclusive. |
| Evidence Report | Generated aggregate tables and failure counts | Read figures from the current `evidence/summary.json` only. QualityGate-v1 and the original pulse/blink policy are distinct. Do not recite stale hard-coded counts. |
| Optional Model Lab | Logistic regression, TRAINING DATA ONLY warning, shuffled-label control and one explanation | Training-data exploration says nothing about new sessions. Shuffled labels can fit a small dataset too. Show no accuracy figure. XGBoost is optional and labeled as a model-capacity/overfitting demonstration. |
| Closing | Local retention/deletion controls and reviewed repository/setup link | No app video recording or automatic physiological-data upload. Saved trials are local; separately exported files need separate deletion. |

## Complete after the recording

- Hosted video URL: pending.
- Fresh live trial ID and actual outcome: pending.
- Fresh replay trial ID or historical source used: pending.
- Public permission for every displayed face, source recording and physiological value: pending confirmation.
- Cuts and speed-up disclosure: pending.
- Final generated post and clean public repository review: pending.

The required live Presage signal must be clearly visible. Do not show private footage merely to satisfy the outline. No script in this project uploads or publishes the demo automatically.
