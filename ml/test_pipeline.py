"""All test records here are synthetic fixtures, never experimental findings."""
import copy
import json
import math
from pathlib import Path
import subprocess
import sys
import unittest

from train import FEATURES, connected_groups, evaluate_report, feature_vector


def fixture(participant=0, index=0, live=True):
    return {"trialId": f"SYNTHETIC-{participant}-{index}", "condition": "live" if live else "injected_replay",
            "durationSec": 60, "endReason": "completed", "protocol": {"durationSec": 60},
            "ml": {"participantId": f"person-{participant}", "sessionId": f"session-{participant}",
                   "recordingGroupId": f"clip-{participant}-{index}", "datasetConsent": True},
            "source": {}, "errors": [], "notes": "SYNTHETIC TEST ONLY",
            "samples": [{"elapsedSec": t, "value": 70 + participant + math.sin(t), "confidence": 80 if live else 45,
                         "stable": True} for t in range(12, 60)],
            "breathingSamples": [{"elapsedSec": t, "value": 14, "confidence": 70} for t in range(30, 60)],
            "validationEvents": [{"elapsedSec": 0, "code": 0}]}


def dataset():
    return {"schema": "spooflab-evidence-v2", "trials": [fixture(p, i, i % 2 == 0) for p in range(6) for i in range(4)]}


class PipelineTests(unittest.TestCase):
    def test_exploratory_fit_is_explicitly_training_only(self):
        d=dataset();d['trials']=d['trials'][:8]
        strict=evaluate_report(d)
        self.assertEqual(strict['status'],'insufficient_data')
        result=evaluate_report(d,mode='exploratory')
        self.assertEqual(result['status'],'exploratory_fitted')
        self.assertEqual(result['evaluationMode'],'training_only')
        self.assertEqual(result['splits'][0]['testTrialIds'],[])
        control=result['shuffledLabelControl']
        self.assertEqual(control['runs'],50)
        self.assertEqual(len(control['shuffledLabelMatches']),50)
        self.assertEqual(control['matchOrExceedReal'],sum(n>=control['realLabelMatches'] for n in control['shuffledLabelMatches']))
        for model in result['models']:
            self.assertNotIn('accuracy',model['metrics'])
            self.assertNotIn('brier',model['metrics'])
            self.assertTrue(all(p['sampleRole']=='training' for p in model['predictions']))
            for p in model['predictions']:
                margin=p['baseValue']+sum(c['contribution'] for c in p['contributions'])
                self.assertAlmostEqual(1/(1+math.exp(-margin)),p['probability'],places=5)

    def test_metadata_is_not_a_predictor(self):
        t = fixture(); other = copy.deepcopy(t)
        other.update(condition="screen_replay", trialId="DIFFERENT", source={"fileName": "evil.mp4"}, notes="wrong")
        other["ml"]["participantId"] = "DIFFERENT"
        self.assertEqual(feature_vector(t), feature_vector(other))
        self.assertEqual(len(feature_vector(t)), len(FEATURES))

    def test_coverage_is_time_binned_not_sample_count(self):
        t = fixture(); t["samples"] *= 10
        self.assertEqual(feature_vector(t)[0], 1)
        t["samples"] = [{"elapsedSec": 12 + i / 1000, "value": 70} for i in range(100)]
        self.assertAlmostEqual(feature_vector(t)[0], 1 / 48)

    def test_no_consent_and_errors_are_excluded(self):
        d = dataset(); d["trials"][0]["ml"]["datasetConsent"] = False
        d["trials"][1]["errors"] = [{"code": 14}]
        r = evaluate_report(d)
        self.assertEqual(len(r["dataset"]["excluded"]), 2)
        self.assertNotIn(d["trials"][1]["trialId"], {p["trialId"] for m in r["models"] for p in m["predictions"]})

    def test_single_participant_is_insufficient(self):
        d = dataset()
        for t in d["trials"]: t["ml"]["participantId"] = "one-person"
        r = evaluate_report(d)
        self.assertEqual(r["status"], "insufficient_data")
        self.assertEqual(r["models"], [])

    def test_single_class_groups_do_not_establish_independent_evidence(self):
        d = dataset()
        # The original trial/group minima and global class balance are met,
        # but each source group now appears in only one class.
        for i, t in enumerate(d["trials"]):
            t["condition"] = "live" if i // 4 % 2 == 0 else "injected_replay"
        r = evaluate_report(d)
        self.assertEqual(r["status"], "insufficient_data")
        self.assertEqual(r["models"], [])
        self.assertEqual(r["dataset"]["eligibleTrials"], 24)
        self.assertEqual(r["dataset"]["excluded"], [])
        audit = r["dataset"]["independentEvidenceAudit"]
        self.assertEqual(audit["mixedGroups"], 0)
        self.assertEqual(audit["singleClassGroups"], 6)
        self.assertFalse(audit["readyForGroupedComparison"])
        exploration = evaluate_report(d, mode="exploratory")
        self.assertEqual(exploration["status"], "exploratory_fitted")
        self.assertEqual(exploration["dataset"]["independentEvidenceAudit"], audit)

    def test_two_mixed_plus_two_pure_groups_are_retained_but_not_ready(self):
        d = dataset(); d["trials"] = d["trials"][:16]
        for i, t in enumerate(d["trials"]):
            if i >= 8:
                t["condition"] = "live" if i < 12 else "injected_replay"
        r = evaluate_report(d)
        self.assertEqual(r["status"], "insufficient_data")
        self.assertEqual(r["dataset"]["independentGroups"], 4)
        self.assertEqual(r["dataset"]["independentEvidenceAudit"]["mixedGroups"], 2)
        self.assertEqual(r["dataset"]["eligibleTrials"], 16)
        self.assertEqual(r["splits"], [])

    def test_recording_hash_links_participants(self):
        a, b, c = fixture(0), fixture(1), fixture(2)
        a["source"]["sha256"] = b["source"]["sha256"] = "abc"
        b["ml"]["recordingGroupId"] = c["ml"]["recordingGroupId"] = "shared"
        self.assertEqual(len(set(connected_groups([a, b, c]))), 1)

    def test_excluded_bridge_still_links_provenance(self):
        d = dataset()
        for t in d["trials"]:
            t["source"]["sha256"] = "one-recording"
        d["trials"][0]["ml"]["datasetConsent"] = False
        self.assertEqual(evaluate_report(d)["dataset"]["independentGroups"], 1)

    def test_end_to_end_group_split_and_contribution_additivity(self):
        r = evaluate_report(dataset())
        self.assertEqual(r["status"], "evaluated")
        self.assertEqual(r["dataset"]["independentEvidenceAudit"]["mixedGroups"], 6)
        self.assertTrue(r["dataset"]["independentEvidenceAudit"]["readyForGroupedComparison"])
        for split in r["splits"]:
            self.assertFalse(set(split["trainGroups"]) & set(split["testGroups"]))
            self.assertFalse(set(split["trainTrialIds"]) & set(split["testTrialIds"]))
        for model in r["models"]:
            self.assertEqual(len(model["predictions"]), 24)
            self.assertEqual(len({p["trialId"] for p in model["predictions"]}), 24)
            self.assertEqual(sum(b["count"] for b in model["metrics"]["calibration"]), 24)
            for p in model["predictions"]:
                margin = p["baseValue"] + sum(c["contribution"] for c in p["contributions"])
                self.assertAlmostEqual(1 / (1 + math.exp(-margin)), p["probability"], places=5)
        json.dumps(r, allow_nan=False)

    def test_duplicate_ids_rejected(self):
        d = dataset(); d["trials"].append(d["trials"][0])
        with self.assertRaises(ValueError): evaluate_report(d)

    def test_stdin_json_only_no_storage(self):
        run = subprocess.run([sys.executable, str(Path(__file__).with_name("train.py")), "--stdin", "--output", "-"],
                             input=json.dumps({"schema": "spooflab-evidence-v2", "trials": []}), text=True, capture_output=True, check=True)
        self.assertEqual(json.loads(run.stdout)["status"], "insufficient_data")


if __name__ == "__main__": unittest.main()
