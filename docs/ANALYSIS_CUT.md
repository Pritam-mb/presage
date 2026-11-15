# Analysis scope and evidence limits

## A1: paired agreement cannot currently be estimated

`node scripts/analyze.cjs` creates `evidence/analysis/paired.json` from the existing consolidated local trial dataset. Its top-level `n` counts explicitly attested source-recording pairs, not participants with both live and replay conditions. No source-recording pairing manifest is available, so the current paired sample is empty. Same-person identities, adjacent capture times and recording-group aliases do not establish that a particular live SDK trial measured the exact footage later replayed.

The report therefore retains **within-person descriptive condition comparisons**, individual trial means and observed 12-second output-window means. It does not relabel them as paired recordings, estimate limits of agreement or make a measurement-accuracy claim. The previously reported mother's pooled SDK-output difference remains a descriptive condition comparison, not synchronized agreement against ground truth. No original trial metadata was altered to create a pair.

The pooled comparison includes only completed, consented trials with explicit local dataset metadata. SDK estimates and output windows are correlated. Differences can reflect time, display recapture, warnings and camera conditions.

## A2: retained with restricted simulation support

Saved `faceSamples` retain stable/unstable detection flags and timestamps across replay trials, so A2 is implemented rather than cut. `evidence/analysis/challenge-tradeoff.json` reports simulation sample sizes, measured live outcomes and a counter audit separately. Prompts are simulated only within continuously observed stable segments; missing intervals are never filled or interpreted as eyes open. The simulation uses the existing exact-count, stable false-to-true rising-edge counter and its 250 ms debounce.

Results are conditional on these few recorded SDK timelines and their artifacts. Draws overlap, recordings may repeat, and the number of simulation draws is not the number of independent trials. Saved live challenge passes/failures are not a validated false-reject estimate. Reproducing the stored one-requested/six-counted result establishes counter consistency, not correspondence with six actual human blinks. Without annotated original video, false or repeated detections cannot be ruled out.

Both analysis files are local sensitive derived artifacts. They are excluded from the source-only repository and do not establish publication consent. Every output references the source dataset's hash for reproducibility.
