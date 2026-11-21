# HARNESS STATUS

Run: 2026-11-21T23:13:38.739Z | mode: FINAL | authorized amendments plus v3 additions

| Gate | Check | Type | Result | Detail |
|---|---|---|---|---|
| G0.1 | .env and artifacts are git-ignored | hard | PASS | check .gitignore |
| G0.2 | LICENSE present | hard | PASS |  |
| G0.3 | No .env secret value appears in any other file | hard | PASS |  |
| G0.4 | No hard-coded key-like strings | hard | PASS |  |
| G1.1 | syntax/check | hard | PASS |  |
| G1.2 | unit tests | hard | PASS |  |
| G1.3 | build | hard | PASS |  |
| G2.1 | Camera diagnostic evidence shows >= 25 FPS | hard | PASS | evidence/real/camera_fps.json |
| G2.2 | Trial files are valid, real, consented, and contain no identifiers | hard | PASS |  |
| G2.3 | Retained quality-limited live attempts (not qualifying baselines) | soft | PASS | {"n":2,"trial_ids":["0b38c461-d258-4a26-9bdc-eacc0030ba64","a9efc86a-a71f-4ce2-a5d1-1478f8de2aa6"]} |
| G3.1 | Minimum real trials per condition ({"live":3,"photo":2,"screen_replay":3,"injected_replay":3}) | hard | PASS | {"live":17,"photo":2,"screen_replay":10,"injected_replay":3} |
| G3.2 | At least one completed live trial with signal_observed | hard | PASS |  |
| G3.3 | Inconclusive trials are reported, not dropped (summary lists them) | hard | PASS |  |
| G3.4 | summary.json matches a fresh recomputation | hard | PASS |  |
| G4.1 | No unqualified liveness/diagnosis/medical claims | hard | PASS |  |
| G5.1 | README/SUBMISSION cover consent, storage, sharing, retention, deletion, telemetry, AI services, setup | hard | PASS |  |
| G5.2 | submission.json has repo, video, post URLs (final only) | hard | PASS | docs/submission.json |
| G5.3 | Originality scan recorded (date + entries compared) | hard | PASS | docs/ORIGINALITY.md must compare against existing entries |
| G5.4 | Post has no unresolved {{tokens}} and keeps published:false until final | hard | PASS | docs/POST.md |
| G6.1 | Time left to contest deadline: 32.8 h (internal cutoff in 7.3 h) | soft | PASS |  |
| G5.5 | Manual M1-M5 attestations explicitly signed (final only) | hard | PASS | Never inferred from file existence. Actual operator review is still required. |
| G5.6 | Completed originality review within 48 hours (final only) | hard | PASS | Requires actual dated review, source links and comparison; placeholder mentions do not satisfy this gate. |
| G7.1 | Optional window-leakage demo not used (allowed) | soft | PASS |  |
| G7.2 | Local exploratory and strict ML evidence is consistent | hard | PASS | Checks prediction/contribution provenance, shuffled controls and matched-group guard. Optional window-leakage results are separate. |
| G8.1 | Source-blind policy signatures and behavioral tests | hard | PASS | Policy adapter/evaluator signatures exclude condition, source and recording IDs; policy tests must pass. |
| G8.2 | At least one saved decision trace per frozen policy | hard | PASS | evidence/analysis/policy-traces.json; thresholds, exact metrics, missing fields, reasons, limitations and source reference are required. |
| G9.1 | Derived paired/challenge analyses state n, or explain the cut | hard | PASS | Derived reports must state n; a substantive ANALYSIS_CUT.md may explain unavailable analyses. |
| G10 | Source-only public repository cleanliness | hard | PASS | Source-only Git index/history check passed. |

ALL HARD GATES PASS.

Frozen policy thresholds are unchanged. Authorized audit corrections are documented in docs/HARNESS_AMENDMENTS.md; the supplied reference is archived verbatim. This audit cannot establish trial honesty, participant permission or the contents of a video. Manual M1–M5 reviews remain separate. No real evidence, Git history, remote or publication is modified.
