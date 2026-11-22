# Record the SpoofLab demo

Aim for a three-minute video built around one question: **Would you ship the stricter rule?** Keep your existing footage wherever the live camera preview, trial timer and changing SDK readings are readable. The most valuable new clips are the blind reveal and the current evidence chart. [Existing walkthrough](https://youtu.be/n5iniN8SBrc)

## Set up the recording on Windows

1. Open SpoofLab with `npm start`. Use the Electron window for the live segment. Collapse the credential panel, silence notifications, and keep names, filenames and group aliases out of the shot. Use your own face or footage specifically approved for public display.
2. In OBS Studio, add **Window Capture**, choose the SpoofLab window, and check that the camera preview appears in the recording preview. Use a 1920 × 1080 canvas at 30 FPS if the computer handles it. Narration can be recorded afterward. Leave the webcam available to SpoofLab.
3. Record the saved-evidence scenes **before** collecting any new trial. The published study contains 32 attempts, and a fresh capture can change the on-screen ledger. Label the chart **“32-attempt study”** in the edit. Use the saved chart if your current ledger differs. [Study chart](assets/policy-tradeoff.png)
4. For fresh live footage, read the consent notice, select the camera and run the six-second FPS check with OBS already recording. Confirm at least 25 delivered FPS. Record the full trial, then select a continuous excerpt where the timer and measurements visibly change. Label any time cut.

## Three-minute edit

| Time | Show this | Suggested narration |
| --- | --- | --- |
| 0:00–0:15 | Open on the Evidence trade-off chart. Hold the pointer on the pulse-only and quality-gated markers. | “Would you ship a stricter webcam presence rule? Mine reduced screen-replay passes from six to two. It also reduced live passes from twelve to seven. Here’s how I measured that.” |
| 0:15–0:55 | **01 Capture.** Show consent, delivered FPS, your camera preview and the running timer. Let viewers see a pulse or breathing estimate change. If the blink prompt appears, show the requested count and its actual outcome. | “SmartSpectra is measuring through my camera. SpoofLab saves the estimates, timing and quality warnings. If I enable the blink prompt, it also records what the counter observed during that window.” |
| 0:55–1:35 | **03 Policy Arena.** Pick a saved trial, select **Pulse only**, then **Score blindly**. Pause on the decision. Open its reasons, then click **Reveal condition**. Rehearse with a saved passing screen replay if you want to illustrate that case. | “The rule has already scored this attempt. It could read the measurements but had no source label. Look at the reason it gave. Now I’ll reveal what the operator put in front of the camera.” Read the actual result on screen. |
| 1:35–2:20 | **04 Evidence.** Hold on the matrix long enough to read its pass, fail and abstain columns. Point first to live and screen replay, then file replay. | “These are the same 32 attempts under three rules. All three file replays still passed the quality gate. The blink rule passed zero of 13 replays, but nine went unscored. Only four supplied enough evidence for it to return a failure.” |
| 2:20–2:45 | **05 Model Lab.** Show the shuffled-label control and the held-out group plot using the study evaluation. | “Eight of fifty shuffled-label fits matched or exceeded the real training fit. Pooled held-out AUC was 0.476. With so few independent groups, I’d need more evidence before relying on this model with new people.” |
| 2:45–3:00 | **06 Export.** Show the format cards. Close on the chart or decision trace. | “A developer can export the evidence behind each decision. Before I tighten a presence rule, I want to know which live attempts it turns away and how often it can decide at all.” |

## Final review

Watch the exported video once at normal speed. Check that the live reading changes visibly, the condition stays hidden until the reveal, and the chart is readable without pausing. If earlier footage says everything stays on-device, replace that line in the audio or mute it and add this caption:

> Model Lab trains locally. SmartSpectra may automatically send derived measurements to Presage for LLM Insights. SpoofLab disables SDK telemetry separately.

Use **Stop Recording** in OBS, then **File → Show Recordings** to locate the file. After uploading, open the video signed out and verify playback. If the upload has a new video ID, update the YouTube embed and link in `docs/POST.template.md`, run `npm run post`, and update `demo_video_url` in `docs/submission.json`.
