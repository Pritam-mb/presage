---
title: "I tried to fool a pulse-based presence check with a recording"
published: false
tags: presagechallenge, devchallenge
---

<!-- Local draft only. Operator review, public-use permissions and actual public links remain pending. -->

## What I Built

SpoofLab is a local physiological testing laboratory for developers. A convincing measurement cannot establish input provenance. SmartSpectra explicitly supports recordings: detecting pulse output in a recording is expected behavior, not an SDK vulnerability.

The Attack Arena runs a frozen measurement-only policy, shows its decision trace, then reveals the operator-declared condition. Policies return pass, fail or abstain. A fresh blink policy is not evaluable when no challenge was issued. Neither pulse nor a blink response proves identity or secure authentication.

## Demo

Live demonstration video: pending operator recording and review. Do not publish this draft until the video visibly shows changing live SDK measurements and approved footage.

## Code

Public source URL: pending. A separate source-only repository is prepared locally. The original working history must not be published.

Setup: install Node and dependencies with `npm ci`, add your own Presage key to the ignored `.env`, then run `npm start`. Use the camera diagnostic before a consented trial. See README for local Python installation if using Model Lab.

## What the data showed

The dataset retains **{{summary.total_trials}} attempts**, including **{{summary.inconclusive_count}} inconclusive measurements**. Condition counts include failures:

| Declared input | Attempts |
| --- | ---: |
| Live | {{summary.by_condition.live}} |
| Photograph | {{summary.by_condition.photo}} |
| Screen replay | {{summary.by_condition.screen_replay}} |
| Injected replay | {{summary.by_condition.injected_replay}} |

A saved replay satisfied an experimental pulse policy with blink disabled. A different run of the same recording failed an exact blink-count challenge. That is an observed mismatch, not evidence of general replay resistance. Photographs remained inconclusive under the original pulse policy. Policy decisions and measurement availability are separate outcomes.

Repeated trials share participants, recordings and equipment. These counts do not establish independent-participant performance.

### Agreement and challenge analyses

The saved records identify **{{summary.research.paired_n}} confirmed source-recording pairs** and **{{summary.research.within_person_comparisons}} same-person condition comparisons**. Same person does not establish which live capture produced the replay. Agreement cannot be estimated from these records; the local paired report retains descriptive observations without inventing linkage or ground truth.

The simulation samples **{{summary.research.challenge_n}} saved replay timelines**, with **{{summary.research.simulation_draws}} draws per configuration**. It uses stable observed segments only, excluding gaps. Passes require the exact requested count under the existing SDK-detection counter.

{{summary.research.challenge_table}}

These are overlapping Monte Carlo draws from a few recordings, not new trials or population replay-resistance estimates. On the measured live side, **{{summary.research.live_challenge_hits}} / {{summary.research.live_challenge_usable}} usable completed challenges** passed, while **{{summary.research.live_challenge_inconclusive}} other attempts** remain inconclusive. Counting consistency does not establish actual blink ground truth: annotated video was unavailable.

## Model Lab

**{{summary.research.shuffled_matches}} / {{summary.research.shuffled_runs}}** shuffled-label fits matched or exceeded the real-label training fit across **{{summary.research.exploratory_trials}}** eligible trials. The control illustrates why training fit is uninformative about new sessions. It is not a significance test. Logistic regression is the default; the optional boosted model is an overfitting inspection.

Strict evaluation reports **{{summary.research.strict_status}}**: only **{{summary.research.mixed_groups}} of {{summary.research.total_groups}} connected groups** contain both live and non-live observations, below the operational minimum of **{{summary.research.minimum_mixed_groups}} mixed groups**. It withholds held-out performance. This matched-group safeguard was added after reviewing the dataset; it is not a preregistered scientific result. It does not alter the exploratory fit or the frozen measurement policies. No generalization claim is made.

## Consent and Data Handling

Consent is required before processing; local ML dataset permission is separate. Public-use permission is required before showing a person's face, recording or physiological series. The app records no video, image or audio. Trial measurements and metadata are stored locally in `data/trials/`, restored at startup and retained until Clear all. Separately exported files, numeric diagnostics and analysis artifacts remain until deleted separately.

There is no automatic sharing, cloud dataset or AI service. Python ML runs locally. SDK telemetry is disabled, but SDK authentication and runtime network behavior still apply. Presage states: “Telemetry does not attach raw video/image frames or measured physiological values.” [Telemetry documentation](https://smartspectra.presagetech.com/docs/telemetry-and-privacy), read November 15, 2026. This quote describes telemetry, not every SDK operation. See docs/PRIVACY.md for storage, retention and deletion details.

## Prize Categories

Best Thoughtful Real-World Use. SpoofLab helps developers inspect assumptions and reproduce failures. It is not a production verification product.

## Limits and next steps

Small, uneven data, capture warnings and repeated sources constrain the findings. Adaptive video generation, a compromised client and a live accomplice are out of scope. The broader SignalTrust study has not been run. No further models or external LLM are part of this MVP.
