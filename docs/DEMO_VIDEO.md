# Demonstration Video Script and Recording Plan

Status: **Ready for Recording**.  
Hosted Demo Video: [https://youtu.be/n5iniN8SBrc](https://youtu.be/n5iniN8SBrc)  
Target Duration: ~3 minutes (180 seconds)  
Public Repository: [https://github.com/Pritam-mb/presage](https://github.com/Pritam-mb/presage)  

---

## 1. Pre-Flight Recording Checklist

1. **Environment Setup:**
   - Launch the application: `npm start` (or `node scripts/launch.cjs`).
   - Window size: set capture resolution to 1920×1080 (16:9) or 1280×720 fullscreen.
   - UI Accent: ensure the dark instrument console UI is active (`--bg: #0A0D0B`, `--signal: #2EE59D`).
2. **Credential & Privacy Protection:**
   - Keep the API key drawer collapsed; never display `.env` secrets or API credentials.
   - Ensure participant consent is recorded prior to capture.
   - The app records no video or audio stream to disk; only physiological telemetry is processed locally.
3. **Camera Quality Requirements:**
   - Verify camera frame rate indicator shows delivered $\ge 25\text{ FPS}$.
   - Ensure consistent, diffuse lighting on the face so SmartSpectra pulse and breathing signals track smoothly.

---

## 2. Sequence Overview

| Timestamp | Workspace Screen | On-Screen Visual Focus | Voiceover Subject |
|---|---|---|---|
| **0:00 – 0:30** | `01 Capture Lab` | Precision instrument UI, reticle HUD, status chips, readouts. | The core problem: why replays contain pulse signals. |
| **0:30 – 1:15** | `01 Capture Lab` | Live trial start, warm-up ring, changing pulse/breathing, blink challenge. | Live physiological measurement vs freshness challenges. |
| **1:15 – 1:45** | `01 Capture Lab` | Input condition selector: screen replay and digital injected replay. | The replay dilemma: naive pulse rules pass replays. |
| **1:45 – 2:20** | `03 Policy Arena` | Frozen policy tabs, blind trial evaluation, 3D reveal transition, trade-off matrix. | Policy Arena: evaluating rules without condition leakage. |
| **2:20 – 2:45** | `02 Trust & 04 Evidence` | Trust boundary lanes, evidence ledger with 33 attempts and Wilson intervals. | Separation of measurement from verdict; keeping inconclusive trials. |
| **2:45 – 3:05** | `05 Model Lab & 06 Export` | Model Lab exploratory banner, AUC plots, JSON export and Clear all control. | Local-only ML limitations, privacy, and verifiable evidence. |

---

## 3. Word-for-Word Voiceover Script

### Scene 1: Introduction & The Core Problem (0:00 – 0:30)
* **Screen:** `01 Capture Laboratory`
* **Visual Action:** Cursor highlights the top status strip (Consent, Camera FPS $\ge 25$, SDK status), then hovers over the preview reticle and the three instrument gauges (`Pulse BPM`, `Breathing`, `Confidence`).
* **Spoken Script:**
  > *"When an application developer uses a camera-derived pulse sensor to decide whether a live person is present—such as in remote proctoring or attendance check-ins—there is a major catch: a recorded video of a person still contains a pulse.*
  >
  > *SmartSpectra measures physiological signals from video as designed. Detecting pulse output from a recorded screen replay is expected sensor behavior, not a flaw in the sensor. I built **SpoofLab**, a local testing workbench, to examine what happens when developers build decision rules on top of those measurements, and where those rules fail."*

---

### Scene 2: Live Trial & Blink Freshness Challenge (0:30 – 1:15)
* **Screen:** `01 Capture Laboratory`
* **Visual Action:** Check consent in the right stepper, click **Start capture**. Show the 12-second warm-up ring progressing. Keep face centered so changing pulse BPM and breathing values update with active mini-sparklines. When the prompt appears (*"Blink 2 times"*), complete the blinks naturally and let the counter record the rising edges.
* **Spoken Script:**
  > *"In the Capture Laboratory, we initiate a live trial. The redesigned interface operates as a precision lab instrument. As the twelve-second warm-up completes, SmartSpectra establishes physiological lock.*
  >
  > *Notice that heart rate and breathing rate update continuously with active sparklines, validation indicators, and real-time delivered frame rate tracking.*
  >
  > *During capture, an experimental freshness challenge issues a randomized instruction—such as requesting an exact count of two blinks. The trial records observed transitions, stable fractions, and validation flags into local storage."*

---

### Scene 3: The Replay Dilemma (1:15 – 1:45)
* **Screen:** `01 Capture Laboratory`
* **Visual Action:** Open the **Source** dropdown in the right-hand stepper. Show the 4 inputs: `Live baseline`, `Printed photograph`, `Screen replay`, and `Injected replay`. Select `Screen replay` or show an existing replay trial.
* **Spoken Script:**
  > *"Next, we inspect replays. SpoofLab tests four declared inputs: live baseline, printed photographs, screen replays shown on a secondary monitor, and injected digital video files.*
  >
  > *Because the camera detects photoplethysmographic color changes from screen pixels, a naive decision rule that checks only 'was a pulse detected' passes almost all screen replays and every injected file replay. The sensor measures physiology accurately, but the naive application rule cannot distinguish a live human from a screen."*

---

### Scene 4: Policy Arena — Blind Evaluation & The Reveal (1:45 – 2:20)
* **Screen:** `03 Policy Arena`
* **Visual Action:** Switch to the Policy Arena view via the left rail. Click between the frozen policies (`Pulse only`, `Quality gated`, `Pulse + blink`) showing the frozen threshold badges. Select a trial with its declared condition hidden. Click **Evaluate** (showing the blind verdict card), then click **Reveal** to trigger the 3D flip card animation. Scroll down to show the scoreboard matrix.
* **Spoken Script:**
  > *"To evaluate rules without bias, we built the Policy Arena. It runs three frozen rules against saved measurements, completely blind to the operator's declared condition label.*
  >
  > *We select an attempt, evaluate it, read the exact metrics and missing fields, and only then press 'Reveal'. The card flips to expose the true input condition.*
  >
  > *The trade-off scoreboard makes the cost visible: adding a strict quality gate reduces screen replay passes down to two, but it also causes live passes to drop from twelve down to seven. Adding an exact blink challenge eliminates replay passes, but abstains on live attempts without an observed challenge. Every rule moves the trade-off instead of eliminating it."*

---

### Scene 5: Trust Boundaries & The Evidence Ledger (2:20 – 2:45)
* **Screen:** `02 Trust Boundaries`, then `04 Evidence`
* **Visual Action:** Open `Trust Boundaries` to show the 3 horizontal lanes: `MEASUREMENT` $\rightarrow$ `POLICY` $\rightarrow$ `VERDICT`. Then switch to `Evidence` to show the summary cards (33 attempts, completed, inconclusive) and scroll the sortable evidence ledger.
* **Spoken Script:**
  > *"In Trust Boundaries, we clearly separate the layers: sensor measurement is distinct from application policy, which is distinct from a verifier outcome. A physiological reading is never proof of live presence.*
  >
  > *In the Evidence Report, all 33 attempts remain in the denominator—including the ten inconclusive trials. Silently discarding inconclusive or low-frame-rate attempts would artificially flatter the metrics. Retaining every attempt with Wilson confidence intervals gives reviewers an honest, auditable ledger."*

---

### Scene 6: Model Lab & Privacy Wrap-Up (2:45 – 3:05)
* **Screen:** `05 Model Lab`, then `06 Export`
* **Visual Action:** Switch to `Model Lab`, point out the warning banner (*"Exploratory. Nothing here measures accuracy on new people."*), highlight the grouped AUC plot and the 50-run shuffled label control. Switch to `Export` to show the format cards and the **Clear all evidence** button.
* **Spoken Script:**
  > *"Finally, Model Lab investigates whether machine learning could improve on hand-written rules. On consented trials, our 50-run shuffled-label control matched the training fit eight times, and leave-one-group-out cross-validation produced a confidence interval spanning chance.*
  >
  > *SpoofLab operates entirely locally. No video or biometric data is ever uploaded to external servers, and all evidence can be purged with a single click. SpoofLab provides developers with an honest, verifiable workbench to test their presence assumptions before putting them in front of real users."*

---

## 4. Compliance and Claim Safeguards

To maintain strict compliance with audit gates (G4.1, G5.1, G5.4):
- **Permitted descriptions:** *"Rule passed"*, *"Rule failed"*, *"Rule could not score (abstained)"*, *"physiological measurement"*, *"freshness challenge"*, *"presence check"*.
- **Explicitly negated terms:** No claim of "proves liveness", "detects deepfakes", "secure authentication", or medical diagnosis; all physiological measurements are strictly for developer engineering analysis.
