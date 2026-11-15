# Model Lab limitations

Model Lab demonstrates what a classifier can learn from a tiny, declared dataset. Its exploratory outputs must say: **training-data exploration, not accuracy on new sessions**.

## Two separate modes

Exploratory mode fits and explains predictions on the same eligible records. Logistic regression is the default presentation; XGBoost is optional fitting/overfitting inspection. The per-trial scores are uncalibrated. Coefficient or TreeSHAP contributions explain the fitted calculation; they are not evidence of physical causality or input provenance. Aggregate training-accuracy figures must not promote these fits.

The shuffled-label control fits 50 logistic models after permuting row labels while preserving class counts. Its match/exceed count is a diagnostic of training-fit flexibility, not a significance test or chance-corrected performance measure. Row shuffling does not preserve participant structure. The headline must be loaded from the current generated result, not hardcoded from an earlier run.

The strict grouped mode is an independent-evidence check. It must decline unsupported performance claims when grouping is inadequate or class/source confounding prevents a meaningful comparison. A mechanically valid split alone does not establish a valid scientific design. The current data include people who appear only in photo or replay conditions, so identity, source processing and condition may be confounded.

## Data and leakage

Participant, session, recording and shared-file relationships must be honest. All derivatives of one recording stay connected; changing aliases does not create independence. Condition, source type, path, filename and participant identity are not predictor features. Source metadata may only define the labels, audit groups and post-decision comparison.

Dataset consent is separate from capture consent. Local training permission does not authorize public physiological series, footage or participant names. Failed captures remain evidence and are reported as exclusions when their data cannot support feature extraction; they are not silently converted to successful negative examples.

## Scope

The dataset is small and uneven across people and conditions. Lighting, camera, codec, frame rate and validation warnings can be learned instead of physiology. Faithful live and replay inputs can contain indistinguishable measurement information. This project does not establish reliable classification on unseen sessions or people, production attack resistance, secure identity or any medical conclusion.

No external AI service is used. The protected `04_ML_ADDON_SPEC.md` is absent from the supplied workspace; this document does not claim its reference implementation has been provided or reproduced. SignalTrust and additional ML models remain out of challenge scope.
