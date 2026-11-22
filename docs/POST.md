---
title: "SpoofLab: What a stricter webcam presence rule cost live users"
published: false
tags: presagechallenge, devchallenge
---

*This is a submission for the [Presage SmartSpectra SDK Challenge](https://dev.to/challenges/presage-2026-11-04).*

**TL;DR** I built SpoofLab to help developers test what happens when an app treats a webcam pulse as evidence that someone is present. Adding a quality check reduced screen-replay passes from **6 to 2 out of 10**. It also reduced live passes from **12 to 7 out of 17**. SpoofLab lets you open the decision behind any of those counts and see exactly what the rule knew.

## What I Built

SpoofLab is a Windows desktop lab built with Electron and SmartSpectra. Imagine you maintain an app that asks someone to look into a webcam before continuing. You add a pulse requirement. Then someone points the webcam at a recording, and the SDK returns pulse estimates. SmartSpectra supports recorded input. The engineering question is whether your application's rule should let that attempt continue.

### One saved attempt, three different answers

One completed screen replay makes the rules easier to understand. I took its saved measurements and scored them three times. The camera input and the observations were identical each time.

| Frozen rule | What the decision trace showed | Outcome |
| --- | --- | --- |
| Pulse only | After the 12-second warm-up, the trial had 39 distinct pulse estimates. The rule requires at least 10. | **Pass** |
| Quality gated | About 85% of those estimates were stable, above the 50% minimum. But about 30% of frames with known validation status carried a warning, above the 20% maximum. | **Fail** |
| Pulse plus fresh blink | The trial had no recorded challenge issuance. There was no requested response to evaluate. | **Abstain** |

That last distinction matters to the person using the app. "You failed the challenge" would be a poor explanation for a challenge they were never asked to complete. SpoofLab keeps the reason alongside each decision.

### How to follow an attempt through the six tabs

#### 01 / Capture

Choose the input, review consent, and check the camera's delivered frame rate. During capture, watch the pulse timeline and breathing readout alongside warnings. If a trial ends early, its stop reason stays in the ledger.

![SpoofLab Capture workspace](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/s8fyj5dktbs034huhw2o.png)

#### 02 / Trust Boundaries

Select a trial and follow three steps: what the SDK measured, what the trial's configured rule required, and what it decided. A pulse estimate tells you what the camera picked up. The input's physical origin remains outside that measurement.

![Trust Boundaries workspace](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/hp3fk1zplviw82de7710.png)

#### 03 / Policy Arena

Select a saved attempt with its condition hidden. Choose a frozen rule, click **Score blindly**, and inspect its reasons. Then click **Reveal condition** to see what the operator presented. This is where you can reproduce the three answers above.

![Policy Arena workspace](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/vzepgt3bksr9sbotxfda.png)

![Additional view of the policy evaluation](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/qn74i1er8ek44xkxb59r.png)

#### 04 / Evidence

Zoom out from one decision to all retained attempts. Compare live and replay pass counts, inspect the overlap in signal quality, and open a ledger row to examine its validation history. The chart keeps abstentions in the denominator.

![Evidence Report overview](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/ugzj3pkkf6qdjijgwgel.png)

![Study evidence in SpoofLab](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/5wfmqbavphqmc5j9xd9s.png)

![Additional Evidence Report detail](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/x12qhx6sul0ss77qxplv.png)

#### 05 / Model Lab

Train on separately consented records or open a saved evaluation. Inspect which measurements influenced a fitted prediction. Then compare the fit with shuffled labels and see which groups had enough evidence for a held-out comparison.

![Model Lab workspace](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/kfvcpajny138ujo4xt4z.png)

![Local model evaluation detail](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/3h6aruokhn6j7sde1bdq.png)

#### 06 / Export

Save JSON to reopen the observations, CSV to compare trial rows in a spreadsheet, or HTML to share a readable report. You can also clear the local ledger here.

![Evidence export options](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/xlh33nyz5ujqk4ef9qms.png)

## Demo

{% youtube fza4-QrwgM4 %}

[Watch the SpoofLab walkthrough on YouTube](https://youtu.be/fza4-QrwgM4)

## Code

**[View the SpoofLab source and setup instructions on GitHub](https://github.com/Pritam-mb/presage)**

Use Windows x64, Node.js, a camera, and a Presage API key with cardio access. From the project directory, run:

```powershell
npm ci
npm start
```

Enter the key locally, review the consent notice, choose your camera, and run the six-second frame-rate check. The **Evidence** screen lets you inspect individual attempts, and **Export** saves JSON, CSV, or a readable HTML report.

## How It Responds to Human Signals

I integrated SmartSpectra through its Node/Electron SDK. After consent, the app starts a session for the selected input and requests cardiac and breathing measurements. Enabling the blink challenge also requests facial measurements. The renderer decodes the SDK's timestamped metric updates and listens for validation events while the trial runs.

- **Pulse** updates the BPM readout and timeline. The pulse-only rule counts estimates after the warm-up. The quality rule also checks the fraction of stable estimates and the share of frames with validation errors.
- **Breathing** updates a separate breaths-per-minute readout when the SDK supplies an estimate. It gives the operator another visible live signal and is available to Model Lab as a feature. The frozen pulse rules do not require it.
- **Blink detections** drive the on-screen prompt. During its response window, the app counts transitions into a detected blink and compares the count with the randomized request. A saved trial can therefore show both a successful blink response and an overall rule failure if capture quality fell short.

![SmartSpectra signal capture in SpoofLab](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/qf0o856m76ud9j2hmbha.png)

### From an SDK update to an inspectable decision

A camera's requested frame rate and its delivered frame rate can differ. Capture measures delivery before a webcam trial starts. During a trial, the app decodes each SDK metrics packet, aligns its timestamps to the trial clock, and keeps the original timestamps. A packet can include a reading already delivered in an earlier update. SpoofLab checks timestamps per signal so that receiving the same pulse estimate twice cannot bring a trial closer to the ten-estimate threshold.

When the trial finishes, an adapter extracts the measurements a rule is allowed to read. Its output includes completion status, technical errors, pulse count, stability, frame warnings, and any recorded challenge evidence. The policy function receives those fields and a versioned rule ID. The operator's source label stays outside the function. Only after scoring does the report join the decision with that label to populate the comparison table.

The exported trace records which fields the rule actually read, their values, the thresholds, and the reason it stopped. For the replay above, a developer can tell exactly why a stable-looking pulse still failed the quality check. They can also see why a missing prompt supplied no evidence about the person's ability to blink.

### What happened across the study

I evaluated three frozen rules on **32 attempts**. The pulse rule counts estimates after warm-up. The quality rule also requires enough stable estimates and sufficiently few validation warnings. The blink rule adds a fresh prompt and checks whether the observed count matches the requested count.

Read each cell as **pass / fail / abstain**. A failure means the available evidence missed a requirement. An abstention means the rule had too little usable evidence to decide.

| Frozen rule (pass / fail / abstain) | Live (17) | Screen replay (10) | Injected replay (3) | Printed photo (2) |
| --- | ---: | ---: | ---: | ---: |
| Pulse only | 12 / 0 / 5 | 6 / 2 / 2 | 3 / 0 / 0 | 1 / 0 / 1 |
| Quality gated | 7 / 5 / 5 | 2 / 6 / 2 | 3 / 0 / 0 | 0 / 1 / 1 |
| Pulse + blink | 3 / 4 / 10 | 0 / 4 / 6 | 0 / 0 / 3 | 0 / 0 / 2 |

Of the 32 attempts, **24 completed the planned duration**. The 8 early endings had these recorded reasons: low frame rate (2), manual (6). They remain in the denominators.

![Study results for the frozen rules](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/elaxeemvrjztdm3l4v57.png)

**Did the blink prompt work?** On live attempts, **6 of 6 usable completed prompts** matched the requested count. The full blink rule passed only **3 of 17 live attempts** because pulse and capture quality also counted. On screen replays it recorded zero passes, but abstained on 6 of 10. It also abstained on every file replay. Counting those abstentions as successful detections would overstate what the experiment showed.

### What the model learned

Model Lab trained locally on **16 eligible trials**. In the shuffled-label control, **8 of 50** logistic regression fits matched or exceeded the training fit obtained with the real labels. XGBoost returned the same score for every training record.

For evaluation, related trials are connected through their declared participant, session or recording group. A repeated recording can contribute several rows to a table while adding very little independent information. Holding a whole group out asks a harder question than fitting and scoring the same rows: how does the model rank trials from a group it did not train on?

Holding out entire groups gave a pooled AUC of **0.476**. Only 3 of 5 connected groups contained both live and non-live trials. These results tell me how the models behaved on this small collection. How well they would work on a new person or setup remains open.

![Model Lab study results](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/3n7t2bf48yrnzjtnjip5.png)

## Prize Categories

**Best Thoughtful Real-World Use.** Consider a developer deciding whether to require a quality check before someone can continue in an app. The Evidence tab shows the benefit and the cost on the same attempts. The Arena lets the developer inspect a single decision when the aggregate hides an important detail, such as a replay for which the blink prompt never ran. SpoofLab gives developers a way to ask, before shipping a presence check: *Which live attempts would this rule turn away, and how often would it have enough evidence to decide?*

## Consent and Data Handling

Capture requires processing consent. A photo or recording requires its owner's permission. Local ML training requires a separate opt-in. Showing someone's face, recording, or individual measurements publicly requires permission for that use.

SpoofLab saves trial measurements and metadata locally in `data/trials/`. It records no video, images, or audio. **Clear all** deletes the desktop trial store. Exported reports, diagnostics, and analysis files must be deleted separately.

SpoofLab disables SDK telemetry and trains its own models locally. SmartSpectra also documents automatic LLM Insights that can send derived pulse, breathing, and heart-rate variability measurements with session metadata to Presage for forwarding to an LLM. Presage excludes raw imagery from the Insights payload. SpoofLab makes no on-demand Insights requests. I did not inspect network traffic from past sessions. [Presage telemetry documentation](https://smartspectra.presagetech.com/docs/telemetry-and-privacy) · [Presage Insights privacy notice](https://smartspectra.presagetech.com/docs/llm-insights/)

![SpoofLab consent and data handling](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/8bmgbnhh2ivb3hlvlmlo.png)

<!-- Optional Agent Session: add a reviewed public DEV agent-session embed here if available. -->
