---
title: "SpoofLab: What a stricter webcam presence rule cost live users"
published: false
tags: presagechallenge, devchallenge
---

I added a quality check to a webcam pulse rule. Across the same {{summary.by_condition.screen_replay}} screen replays, passes fell from **{{summary.research.naive_screen_pass}} to {{summary.research.gated_screen_pass}}**. Across the same {{summary.by_condition.live}} live attempts, passes also fell, from **{{summary.research.naive_live_pass}} to {{summary.research.gated_live_pass}}**. All {{summary.by_condition.injected_replay}} file replays still passed.

I built **SpoofLab** to make that trade-off visible. SmartSpectra can measure physiology from a recording. When a developer uses those measurements to decide whether someone is present, what evidence actually supports the decision?

## What I Built

SpoofLab is a Windows desktop workbench built with Electron and the Presage SmartSpectra SDK. In **Capture**, a consenting participant can watch pulse and breathing estimates arrive alongside the camera frame rate and SDK warnings. A trial can include a randomized blink prompt. If capture stops early, the attempt stays in the ledger with its stop reason.

<!-- SCREENSHOT 1 | Upload a Capture screenshot here. Suggested alt text: Live pulse and breathing readouts beside the capture timer. Use a frame cleared for publication and crop out credentials or identifying filenames. -->

The part I would try first is **Policy Arena**. Pick a saved attempt with its input label hidden. Choose a rule and score it. You can inspect the observations it used, the thresholds it applied, and any missing fields **before** revealing what was in front of the camera. The declared input comes from the operator and is kept out of the scoring function.

<!-- SCREENSHOT 2 | Upload a Policy Arena screenshot here. Suggested alt text: A scored attempt showing the rule, its decision, and the evidence used. -->

## Demo

{% youtube n5iniN8SBrc %}

[Watch the SpoofLab walkthrough on YouTube](https://youtu.be/n5iniN8SBrc)

## What the trials showed

I evaluated three frozen rules on **{{summary.total_trials}} attempts**. The pulse rule counts estimates after warm-up. The quality rule also requires enough stable estimates and sufficiently few validation warnings. The blink rule adds a fresh prompt and checks whether the observed count matches the requested count.

Read each cell as **pass / fail / abstain**. A failure means the available evidence missed a requirement. An abstention means the rule had too little usable evidence to decide.

{{summary.research.frozen_policy_table}}

Of the {{summary.total_trials}} attempts, **{{summary.completed}} completed the planned duration**. The {{summary.incomplete}} early endings had these recorded reasons: {{summary.research.failure_text}}. They remain in the denominators.

<!-- SCREENSHOT 3 | Upload docs/assets/policy-tradeoff.png here, or use the current Evidence trade-off chart. Suggested alt text: Live pass share versus replay pass share for each rule, with trial counts and Wilson intervals. -->

**Did the blink prompt work?** On live attempts, **{{summary.research.live_challenge_hits}} of {{summary.research.live_challenge_usable}} usable completed prompts** matched the requested count. The full blink rule passed only **{{summary.research.blink_live_pass}} of {{summary.by_condition.live}} live attempts** because pulse and capture quality also counted. On screen replays it recorded zero passes, but abstained on {{summary.research.blink_screen_abstain}} of {{summary.by_condition.screen_replay}}. It also abstained on every file replay. Counting those abstentions as successful detections would overstate what the experiment showed.

## What Model Lab added

Model Lab trained locally on **{{summary.research.exploratory_trials}} eligible trials**. In the shuffled-label control, **{{summary.research.shuffled_matches}} of {{summary.research.shuffled_runs}}** logistic regression fits matched or exceeded the training fit obtained with the real labels. XGBoost returned the same score for every training record.

Holding out entire groups gave a pooled AUC of **{{summary.research.limits_pooled_auc}}**. Only {{summary.research.mixed_groups}} of {{summary.research.total_groups}} connected groups contained both live and non-live trials. These results tell me how the models behaved on this small collection. How well they would work on a new person or setup remains open.

<!-- SCREENSHOT 4 | Upload the Model Lab group plot here. Suggested alt text: Held-out group results, with single-class groups marked unavailable. -->

## Code and setup

Use Windows x64, Node.js, a camera, and a Presage API key with cardio access. From the project directory, run:

```powershell
npm ci
npm start
```

Enter the key locally, review the consent notice, choose your camera, and run the six-second frame-rate check. The **Evidence** screen lets you inspect individual attempts, and **Export** saves JSON, CSV, or a readable HTML report. [SpoofLab source and setup instructions](https://github.com/Pritam-mb/presage)

## Consent and Data Handling

Capture requires processing consent. A photo or recording requires its owner's permission. Local ML training requires a separate opt-in. Showing someone's face, recording, or individual measurements publicly requires permission for that use.

SpoofLab saves trial measurements and metadata locally in `data/trials/`. It records no video, images, or audio. **Clear all** deletes the desktop trial store. Exported reports, diagnostics, and analysis files must be deleted separately.

SpoofLab disables SDK telemetry and trains its own models locally. SmartSpectra also documents automatic LLM Insights that can send derived pulse, breathing, and heart-rate variability measurements with session metadata to Presage for forwarding to an LLM. Presage excludes raw imagery from the Insights payload. SpoofLab makes no on-demand Insights requests. I did not inspect network traffic from past sessions. [Presage telemetry documentation](https://smartspectra.presagetech.com/docs/telemetry-and-privacy) · [Presage Insights privacy notice](https://smartspectra.presagetech.com/docs/llm-insights/)

## Prize Categories

**Best Thoughtful Real-World Use.** SpoofLab gives developers a way to ask, before shipping a presence check: *Which live attempts would this rule turn away, and how often would it have enough evidence to decide?*
