---
title: "SpoofLab: What a stricter webcam presence rule cost live users"
published: false
tags: presagechallenge, devchallenge
---

I added a quality check to a webcam pulse rule. Across the same 10 screen replays, passes fell from **6 to 2**. Across the same 17 live attempts, passes also fell, from **12 to 7**. All 3 file replays still passed.

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

I evaluated three frozen rules on **32 attempts**. The pulse rule counts estimates after warm-up. The quality rule also requires enough stable estimates and sufficiently few validation warnings. The blink rule adds a fresh prompt and checks whether the observed count matches the requested count.

Read each cell as **pass / fail / abstain**. A failure means the available evidence missed a requirement. An abstention means the rule had too little usable evidence to decide.

| Frozen rule (pass / fail / abstain) | Live (17) | Screen replay (10) | Injected replay (3) | Printed photo (2) |
| --- | ---: | ---: | ---: | ---: |
| Pulse only | 12 / 0 / 5 | 6 / 2 / 2 | 3 / 0 / 0 | 1 / 0 / 1 |
| Quality gated | 7 / 5 / 5 | 2 / 6 / 2 | 3 / 0 / 0 | 0 / 1 / 1 |
| Pulse + blink | 3 / 4 / 10 | 0 / 4 / 6 | 0 / 0 / 3 | 0 / 0 / 2 |

Of the 32 attempts, **24 completed the planned duration**. The 8 early endings had these recorded reasons: low frame rate (2), manual (6). They remain in the denominators.

<!-- SCREENSHOT 3 | Upload docs/assets/policy-tradeoff.png here, or use the current Evidence trade-off chart. Suggested alt text: Live pass share versus replay pass share for each rule, with trial counts and Wilson intervals. -->

**Did the blink prompt work?** On live attempts, **6 of 6 usable completed prompts** matched the requested count. The full blink rule passed only **3 of 17 live attempts** because pulse and capture quality also counted. On screen replays it recorded zero passes, but abstained on 6 of 10. It also abstained on every file replay. Counting those abstentions as successful detections would overstate what the experiment showed.

## What Model Lab added

Model Lab trained locally on **16 eligible trials**. In the shuffled-label control, **8 of 50** logistic regression fits matched or exceeded the training fit obtained with the real labels. XGBoost returned the same score for every training record.

Holding out entire groups gave a pooled AUC of **0.476**. Only 3 of 5 connected groups contained both live and non-live trials. These results tell me how the models behaved on this small collection. How well they would work on a new person or setup remains open.

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
