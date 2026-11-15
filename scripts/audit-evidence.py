"""Consolidate existing reports without modifying originals or inventing group/consent metadata."""
import collections
import csv
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'ml'))
from train import eligibility, evaluate_report


def main():
    sources = sorted((ROOT / 'evidence').glob('*.json')) + sorted((ROOT / 'data/trials').glob('*.json'))
    records, locations, conflicts, issues = {}, collections.defaultdict(list), [], []
    seen = 0
    for source in sources:
        try:
            report = json.loads(source.read_text(encoding='utf-8-sig'))
            if report.get('schema') == 'spooflab-evidence-v2':
                items = report['trials']
            elif 'trialId' in report and 'condition' in report:
                items = [report]  # Earlier autosaves may contain one direct trial.
            else:
                continue
            for t in items:
                seen += 1
                ident = t['trialId']
                fingerprint = hashlib.sha256(json.dumps({k: t.get(k) for k in ('condition','durationSec','endReason','samples','errors')}, sort_keys=True).encode()).hexdigest()
                if ident in records and fingerprint != records[ident][0]:
                    conflicts.append(ident)
                    continue
                records[ident] = (fingerprint, t)
                locations[ident].append(str(source.relative_to(ROOT)))
        except (ValueError, KeyError, TypeError) as e:
            issues.append({'file': source.name, 'error': str(e)})
    trials = [item[1] for item in records.values()]
    rows = []
    for t in trials:
        warnings = collections.Counter(e.get('name', str(e.get('code'))) for e in t.get('validationEvents', []))
        complete = t.get('endReason') == 'completed' and t['durationSec'] >= t.get('protocol', {}).get('durationSec', 90) - .25 and not t.get('errors')
        rows.append(dict(trialId=t['trialId'], condition=t['condition'], durationSec=t['durationSec'], completedWithoutErrors=complete,
                         pulseSamples=len(t.get('samples', [])), lowFpsValidationEvents=warnings.get('kFrameRateTooLow', 0),
                         validationEventCounts=dict(warnings), eligibilityExclusions=eligibility(t), sources=locations[t['trialId']]))
    out = ROOT / 'evidence/analysis'
    out.mkdir(parents=True, exist_ok=True)
    dataset = {'schema': 'spooflab-evidence-v2', 'trials': trials}
    audit = dict(exportedRecordOccurrences=seen, uniqueTrials=len(trials), duplicateOccurrences=seen-len(trials), conflicts=sorted(set(conflicts)), issues=issues,
                 byCondition=dict(collections.Counter(t['condition'] for t in trials)),
                 completedByCondition=dict(collections.Counter(r['condition'] for r in rows if r['completedWithoutErrors'])),
                 cleanFpsCompletedByCondition=dict(collections.Counter(r['condition'] for r in rows if r['completedWithoutErrors'] and not r['lowFpsValidationEvents'])), trials=rows)
    (out / 'audit.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
    with (out / 'grouping-template.csv').open('w', encoding='utf-8', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['trialId','condition','participantId','sessionId','recordingGroupId','datasetConsent'])
        for t in trials:
            ml = t.get('ml') or {}
            writer.writerow([t['trialId'],t['condition'],*[ml.get(k,'') for k in ('participantId','sessionId','recordingGroupId','datasetConsent')]])
    if conflicts or issues:
        print('Audit saved; conflicting or invalid source records must be resolved before evaluation.')
        return
    (out / 'consolidated-dataset.json').write_text(json.dumps(dataset), encoding='utf-8')
    evaluation = evaluate_report(dataset)
    (out / 'evaluation.json').write_text(json.dumps(evaluation, indent=2, allow_nan=False), encoding='utf-8')
    print(json.dumps({k:v for k,v in audit.items() if k != 'trials'}, indent=2))
    print('Evaluation:', evaluation['status'], '| Eligible:', evaluation['dataset']['eligibleTrials'], '| Independent groups:', evaluation['dataset']['independentGroups'])
    print('Original files preserved. Local audit, consolidated dataset and evaluation saved in evidence/analysis/.')


if __name__ == '__main__':
    main()
