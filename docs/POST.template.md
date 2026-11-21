---
title: "I tried to fool a pulse-based presence check with a recording"
published: false
tags: presagechallenge, devchallenge
---

<!-- DRAFT — not ready to publish. Video URL, source URL and screenshot assets are still missing; every media slot below is marked. Do not publish until the slots are filled and the consent notes in the Demo section are satisfied. -->

A recorded video still contains a pulse. SmartSpectra supports recorded input, so finding pulse output in a replay is expected behaviour rather than a flaw in the sensor. If your product treats "the SDK reported a pulse" as evidence that a person is present, the replay is not attacking the SDK. It is walking through a door you left open.

I built SpoofLab to see how wide that door is, door by door, rule by rule.

The useful question is not "can a recording beat a pulse sensor". It is: **when a developer wraps that sensor in a decision rule, which mistakes does the rule make, and can anyone else reproduce them?** A demo that shows one replay passing one check proves almost nothing. A table that shows every retained attempt against every frozen rule, plus the attempts that stayed inconclusive, is evidence a reviewer can argue with.

So the work is deliberately unglamorous. I kept 33 attempts including the failures, froze three decision rules before scoring anything, replayed all three rules over all 33 attempts, and then asked whether a small classifier could do better. On this collection it did not, and the reason is documented rather than hidden.

## What I Built

SpoofLab is a local testing workbench for developers who put camera-derived physiology behind a product decision: a proctoring check, an attendance log, a "is a human here" gate. It uses Presage SmartSpectra to show live pulse and breathing, keeps quality diagnostics, and records every attempt with its settings, validation messages, completion state and limitations.

Four workspaces do different jobs, and the separation is the point:

- **Capture Laboratory** runs a consented trial, shows live pulse and breathing, and stores what the SDK actually delivered, including a trial that produced no usable measurement.
- **Trust Boundaries** shows where sensor output ends and application judgement begins, so a quality warning is not quietly presented as a security decision.
- **Evidence Report** aggregates attempts by declared input, keeps inconclusive attempts in the denominator, and prints the rules used.
- **Model Lab** fits a small local model on consented trials, and is loud about what that fit cannot support.

A fifth view, **Policy Arena**, was added after the first version of this post, because the interesting failures were in decision rules rather than in the sensor.

### The Arena loop

The arena evaluates one frozen policy at a time:

1. Pick a frozen policy and version. Its thresholds are visible before you run it and cannot be edited in the view.
2. Pick a saved attempt **with its declared condition hidden**, or arm a fresh capture with a condition preset.
3. Read the decision, its reasons, the exact metric values it read, the fields that were missing, and the thresholds it applied.
4. Only then reveal the declared input, which attaches the label to the decision.
5. Export the decision trace as JSON if you want to check it outside the app.

That ordering matters. The decision function receives measurements only. The condition label is operator-supplied metadata that is attached after the decision, never passed into it, so a policy cannot "know" it is looking at a replay. A scoreboard keeps the revealed pairs and reports pass counts with Wilson intervals, and it states plainly that passes over attempts include abstentions in the denominator and that repeated people and recordings are not independent samples.

<!-- IMAGE SLOT 1 — Capture Laboratory
![Capture Laboratory: live pulse and breathing, consent attested, real trial timer running](/assets/screenshot-capture-lab.png)
Replace this comment with the image line above once the screenshot exists. Upload it in the DEV editor and use the returned URL. Before capturing: hide the API-key panel and any participant-identifying filenames, and use only a consenting face or consented historical evidence.
-->

### The three frozen rules, exactly

All three are measurements-only. None looks at pixels, filenames or declared conditions.

| Frozen rule | Requirements before it can pass | Decision |
| --- | --- | --- |
| Pulse only / `pulse-only-v1` | Trial completed, no technical errors, at least 10 pulse estimates after a 12-second warm-up | Pass when the count is met |
| Quality gated / `quality-gated-v1` | The above, plus a stable-pulse fraction of at least 0.5 and validation-error frames at or below 0.2 of known frames | Pass only when count, stability and validation evidence all hold |
| Pulse plus blink / `pulse-plus-blink-v1` | The above, plus a fresh randomised blink challenge issued during the trial with a completed, evaluable outcome; the observed blink count must equal the requested count of 1 to 3 | Pass only when count, stability, validation and the challenge all hold |

The third outcome is the important one. A rule returns **abstain** when completion evidence is missing, when the trial ended early, when a technical error occurred, when stability or per-frame validation evidence is absent, or when a blink rule ran without a challenge actually issued during that trial. Abstaining is not a successful rejection. It means the rule could not tell, and counting it as a catch would flatter the numbers.

This is also why the current post has a matrix instead of a single success story. Separation of measurement, policy decision and evidence is the product thesis: a heartbeat is a measurement, "accept" is a policy, and an exported trace is evidence. Collapsing the three into one green check is how presence checks end up trusting a phone pointed at a monitor.

<!-- IMAGE SLOT 2 — Policy Arena decision and reveal
![Policy Arena: a PASS decision with its reasons and metrics, followed by the revealed input condition](/assets/screenshot-arena-reveal.png)
Replace this comment with the image line above once the screenshot exists. Capture one decision with the trace expanded and the reveal visible; a pass on a replay is more informative than a pass on a live trial.
-->

## Demo

{% embed https://www.youtube.com/watch?v=n5iniN8SBrc %}

Live demonstration video: [Watch on YouTube (https://youtu.be/n5iniN8SBrc)](https://youtu.be/n5iniN8SBrc). The recording follows the plan in `docs/DEMO_VIDEO.md`:

1. A real live SmartSpectra trial with changing pulse and breathing, consent attested and the actual timer visible.
2. A visible blink prompt, with its real outcome shown whether it passed, mismatched or stayed inconclusive.
3. A labelled replay, so the same pulse rule can be seen accepting it while a blink rule cannot score it.
4. The Trust Boundaries screen and the generated evidence tables, read from the current `evidence/summary.json`, not from memory.
5. Retention and deletion controls, plus the reviewed setup instructions.

Any cut, time compression or historical clip will be labelled on screen. The original take stays unedited. If someone's face or recording cannot be cleared for publication, the video uses aggregate descriptions instead and says so.

**Media still to add before publishing:** the video above, screenshots 1 to 5, and a short caption under each image stating what it shows and which trial it came from. No image may show an API key, a filesystem username or another person's physiological values.

## How the conditions were recorded

The declared input is the operator's description of the setup, and the app says so in the interface. It is metadata, not authenticated ground truth, which is exactly what the arena is testing.

- **Live.** A consenting person sits in front of the selected camera. The camera-only diagnostic runs first, because negotiated camera settings do not prove delivered frame rate, and a low-FPS capture is retained as a quality-limited attempt rather than deleted.
- **Printed photograph.** A consenting printed photo is held in front of a fixed camera. The SDK may report pulse estimates from it; whatever it reports is retained, including nothing.
- **Screen replay.** A consenting recording plays on a separate display in front of the camera. The phone used as the webcam cannot also be the replay display, because the app would then be filming the device it is running on.
- **Injected replay.** A consenting video file of at least 95 seconds is fed to the SDK as the camera input, played in real time with no looping and no seeking, so the warm-up and trial duration are honest.

Each attempt keeps its declared settings, its validation messages and its completion state. Ten of the 33 attempts are inconclusive, and they stay in the dataset. The alternative, silently dropping the attempts that produced no usable measurement, would make every rule look better and the evidence worthless.

## What the data showed

The dataset retains **{{summary.total_trials}} attempts**, including **{{summary.inconclusive_count}} inconclusive measurements**:

| Declared input | Attempts |
| --- | ---: |
| Live | {{summary.by_condition.live}} |
| Printed photograph | {{summary.by_condition.photo}} |
| Screen replay | {{summary.by_condition.screen_replay}} |
| Injected replay | {{summary.by_condition.injected_replay}} |

The measurement-quality gate is a separate assessment from the three frozen rules, and mixing the two is the easiest way to misread this post. Among attempts that produced a conclusive measurement window, acceptance looked like this:

{{summary.research.gate_acceptance_table}}

Read the intervals, not just the point estimates: 5 of 10 live windows accepted is compatible with anything from "usually rejects live input" to "usually accepts it". The gate accepted 2 of 8 conclusive screen replays and all 3 injected replays. It accepted neither of the 2 conclusive photographs, which sounds reassuring until the frozen matrix below shows what that selectivity costs on live attempts.

### Three frozen rules over the same attempts

Every rule was frozen before scoring, then replayed across every retained attempt. Cells are pass / fail / abstain:

{{summary.research.frozen_policy_table}}

The naive pulse rule accepts most screen replays, every injected replay and **{{summary.research.naive_photo_pass}} of {{summary.research.naive_photo_n}} printed photographs**, because the sensor reports plausible pulse estimates in each case. That is not a bug report. It is what a measurement-only rule inherits from a sensor that is doing its job.

Adding a quality gate cuts screen-replay acceptance from **{{summary.research.naive_screen_pass}} to {{summary.research.gated_screen_pass}}**, but it fails **{{summary.research.gated_live_fail}} of {{summary.research.live_n}}** live attempts. Requiring an observed blink never passes a screen replay (**{{summary.research.blink_screen_pass}} of {{summary.research.blink_screen_n}}** pass, {{summary.research.blink_screen_abstain}} abstain), yet it abstains on every injected replay and on **{{summary.research.blink_live_abstain}} of {{summary.research.live_n}}** live attempts, because no challenge was issued or the requested count was not observed.

The pattern is consistent: **each rule moves the trade-off instead of removing it.** A policy that rejects everything non-live also rejects live people, and a policy that never rejects anything accepts a photograph. Any single headline number from this table can be made to look good by choosing which column to show. The table is the honest unit of evidence, which is why it is here in full.

Repeated attempts share participants, recordings and equipment. These counts describe this small collection, not independent-participant performance, and no interval on this page accounts for that dependence.

<!-- IMAGE SLOT 3 — Evidence Report
![Evidence Report: attempts by declared input, inconclusive counts retained, and the frozen policy table](/assets/screenshot-evidence-report.png)
Replace this comment with the image line above once the screenshot exists. The table values must come from the current evidence/summary.json at capture time.
-->

### Agreement and the blink challenge

The saved records identify **{{summary.research.paired_n}} confirmed source-recording pairs** and **{{summary.research.within_person_comparisons}} same-person condition comparisons**. Knowing that two attempts involve the same person is not the same as knowing which live capture produced a replay. Source hashes are missing or non-matching for most of the collection, so agreement between a live trial and "its" replay cannot be estimated here. The paired report keeps descriptive observations and invents no linkage.

The challenge simulation samples **{{summary.research.challenge_n}} saved replay timelines**, with **{{summary.research.simulation_draws}} draws per configuration**, using stable observed segments only:

{{summary.research.challenge_table}}

The table answers a design question rather than a security question: if a rule waits for *k* blinks inside a 5, 10 or 15-second window, how often would a recorded segment look compliant by chance? Longer windows and higher required counts reduce the pass rate, which is the expected direction, and the numbers are small because the source timelines are few. These are overlapping Monte Carlo draws from a handful of recordings, not new trials and not population estimates.

On the measured live side, **{{summary.research.live_challenge_hits}} / {{summary.research.live_challenge_usable}} usable completed challenges** passed, while **{{summary.research.live_challenge_inconclusive}} other attempts** remained inconclusive. Counting consistency still does not establish actual blink ground truth, because annotated video was unavailable. A rule can match its own count and still be wrong about what the eyes did; this dataset cannot measure that, so the post does not claim it.

## Model Lab

After the rules, the obvious question: could a small model separate live from replayed input better than a hand-written rule? Model Lab runs locally on explicitly consented trials, with Python, scikit-learn and an optional XGBoost inspection. Nine features are used: pulse coverage, mean pulse confidence, stable-pulse fraction, mean and standard deviation of pulse rate, breathing coverage, mean breathing rate, mean breathing confidence, and validation-warning fraction. Source kind, declared condition, file paths and grouping labels are excluded from the predictors, because a model that learns "this file lives in the replay folder" has learned nothing about physiology.

**{{summary.research.shuffled_matches}} / {{summary.research.shuffled_runs}}** shuffled-label fits matched or exceeded the real-label training fit across **{{summary.research.exploratory_trials}}** eligible trials out of 27 consented records. The control illustrates why training fit says nothing about new sessions; it is not a significance test, because row shuffling does not preserve participant dependence. Logistic regression is the default view, and the optional boosted model is an overfitting inspection that collapses to a single constant score on this data.

Strict grouped evaluation reports **{{summary.research.strict_status}}**: only **{{summary.research.mixed_groups}} of {{summary.research.total_groups}} connected groups** contain both live and non-live observations, below the operational minimum of **{{summary.research.minimum_mixed_groups}}** mixed groups, so held-out performance is withheld. That safeguard was added after reviewing the dataset. It is not a preregistered scientific result, and it changes neither the exploratory fit nor the frozen rules, but it does mean no honest independent accuracy number exists for this collection.

The limits analysis exists precisely because that guard fails. Hold out each connected group in turn, fit on the rest, score the held-out group, and the question becomes whether the same features separate live from replayed input *inside* a participant and capture context. The result: **{{summary.research.limits_scored_groups}} of {{summary.research.limits_total_groups}}** groups are scorable at all (the others contain one class), mean within-group AUC **{{summary.research.limits_mean_auc}}**, descriptive 95% group-resampling interval **{{summary.research.limits_interval_text}}**, pooled AUC {{summary.research.limits_pooled_auc}}.

The interval includes chance, so on these records the physiological features do not separate live from replayed input within a group. Pooling the folds produces a number above chance and it must not be read as discrimination; the folds disagree with each other too much for that. This is a limits result, not an estimate of new-session performance, and it is the reason the product ships frozen rules plus an evidence trail instead of a trained classifier. A classifier here would be a confident answer to a question the data cannot answer.

<!-- IMAGE SLOT 4 — Model Lab limits view
![Model Lab: limits analysis selected, with the per-group AUCs, mean, interval and the training-data-only warning visible](/assets/screenshot-model-lab-limits.png)
Replace this comment with the image line above once the screenshot exists. The imported artifact must be the current loocv-limits.json; stale counts from earlier runs must not be shown.
-->

## Reproducing the numbers

Everything above comes from retained local evidence, and the published aggregate is regenerated rather than hand-edited:

```bash
npm ci
npm start                    # launch the workbench

npm run audit:evidence       # validate retained trials
npm run summarize            # rebuild evidence/summary.json
npm run traces               # replay the frozen policies over saved trials
npm run post                 # render this post from the template and summary
```

The limits analysis needs the local Python environment:

```powershell
.\.venv\Scripts\python.exe ml/train.py evidence/analysis/consented-ml-dataset.json --mode loocv --output evidence/analysis/loocv-limits.json
```

`npm test`, `npm run check` and `./.venv/Scripts/python.exe ml/test_pipeline.py` cover the storage, renderer, policy engine, arena, evidence aggregation and the limits report. Raw participant evidence is deliberately not in the repository, so an outside reader can rerun the pipeline on their own trials but cannot regenerate these exact counts from published files. That is a limitation of the evidence model, not a hidden step.

## Consent and Data Handling

Consent is required before processing. Permission to use measurements in the local ML dataset is a separate opt-in, and public-use permission is required before showing a person's face, recording or physiological series. The app records no video, image or audio.

Trial measurements and metadata stay in `data/trials/`, are restored at startup and are retained until **Clear all**; separately exported files remain until deleted separately. There is no automatic sharing, no cloud dataset and no AI service, and no external LLM is called. Python ML runs locally and models are fitted per run; no model file is loaded from elsewhere and nothing is uploaded.

SDK telemetry is disabled, but SDK authentication and runtime network behaviour still apply. Presage states: “Telemetry does not attach raw video/image frames or measured physiological values.” [Telemetry documentation](https://smartspectra.presagetech.com/docs/telemetry-and-privacy), read November 15, 2026. That quote describes telemetry, not every SDK operation. Storage, retention and deletion details are in `docs/PRIVACY.md`.

<!-- IMAGE SLOT 5 — Trust Boundaries
![Trust Boundaries: sensor output, application policy and decision explanation shown as separate layers](/assets/screenshot-trust-boundaries.png)
Replace this comment with the image line above once the screenshot exists.
-->

## What this does not claim

- It is not an authentication system, and a passing rule is not proof of identity. Both are out of scope.
- It is not a detector for generated or adaptive video. A synthesised face that produces plausible physiology is not represented in this dataset, and the frozen rules were not designed against it.
- It does not cover a compromised client that edits its own measurements, a camera pointed at a hidden accomplice, or an operator who mislabels the input. The arena exposes the last one as metadata rather than pretending to authenticate it.
- It does not diagnose, treat or assess health, and pulse and breathing values here are SDK output for engineering inspection, not a health measurement.
- It does not establish population-level error rates. 33 attempts, repeated sources, one operator and one machine cannot.

What it does claim is narrower and checkable: three measurement-only rules, frozen before scoring, produce the matrix above on the retained attempts, with abstentions counted and inconclusive attempts kept.

## Prize Categories

**Best Thoughtful Real-World Use.** SpoofLab helps developers inspect the assumptions behind a presence check before shipping it, and it produces an evidence trail when a rule fails instead of a screenshot of the one time it worked.

## Limits and next steps

The data is small and uneven. Capture warnings persist, several live attempts sit below the quality bar, and the sources repeat. Ten attempts were inconclusive, which is a finding about capture conditions as much as about the rules.

The next experiment is not a bigger model. It is a collection design: independent consenting groups, each contributing both live and replayed attempts inside the same session, with source hashes retained so a replay can be tied to its origin. Freeze the evaluation rules before looking at the new data. Repeat the limits report on that collection, and report the interval rather than the pooled point estimate. If the interval still includes chance, that is the answer and it should be published as one.

The frozen policies would also benefit from one change that this dataset cannot validate: a challenge whose required count adapts to the observed blink rate, evaluated against recorded segments with annotated ground truth. Until annotated video exists, the simulation stays a design exercise, not a security result.

That is the whole project: a small, honest instrument for asking whether your presence check measures presence or just measures a pulse.
