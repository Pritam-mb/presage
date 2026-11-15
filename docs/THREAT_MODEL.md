# Threat model

SpoofLab is a physiological testing laboratory for developers examining the assumptions between a measurement and a security decision. It is not an authentication service or a validated presence detector.

## Question and assets

The experiment asks whether a declared application policy passes an input, and what evidence or uncertainty led to that result. Assets are the integrity of captured measurements and timing, declared trial conditions, the frozen policy specification, traceable decisions and participant privacy. The operator supplies the condition and provenance metadata; SpoofLab cannot independently establish that those labels are true.

## In scope

- A consenting person in front of the camera as the live comparison.
- A printed photograph presented to the camera.
- A consenting recorded face played on a phone or other display and recaptured by the camera.
- A video file supplied directly to the SDK measurement pipeline.

Screen flicker, display processing, compression, camera exposure, framing and motion can affect output. Recorded physiological output is expected SDK behavior. A change between conditions must not automatically be described as an SDK failure or an adversarial detection success.

## Trust boundaries

The source reaches the SDK, the SDK emits measurements and validation information, and an application policy converts those values into a decision. The planned policy engine reads an allowlisted measurement snapshot, with no condition, source or recording ID as policy inputs. The caller attaches the trial reference only after evaluation. Source labels are used for the subsequent reveal and descriptive scoreboard.

The three frozen specifications are `pulse-only-v1`, `quality-gated-v1` and `pulse-plus-blink-v1`; see `protocols/frozen-v1.json`. Engine implementation and arena integration are being completed. Do not label legacy verdicts as decisions from these policies until the new engine has actually produced their traces. Missing quality evidence or an unissued challenge must remain visible as an abstention where required.

## Out of scope

Real-time generated avatars, adaptive puppets, a live accomplice, a compromised client fabricating measurements, camera/device attestation, identity verification, cryptographic proof of physical presence and production security assessment are outside this experiment. A real-time puppet or an incidental recorded blink may satisfy a blink prompt.

A signed, stored or passing result does not prove presence. A hash identifies bytes; it does not establish their origin or owner. Imported reports are unauthenticated. The operator's declared condition and consent are not made trustworthy by passing the measurement pipeline.

Every new policy trace must include: **Input provenance not established. Not proof of live human presence.**
