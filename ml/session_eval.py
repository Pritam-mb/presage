"""Session-based physiological evaluation of SpoofLab real trials.
Evaluates hypothesis H1: Does a replay of a recorded face yield pulse estimates similar to a live session of the same person?
Calculates per-condition, per-participant, and paired live vs replay comparisons without fabricated data.
"""
from __future__ import annotations
import json
import math
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

def load_completed_trials():
    path = ROOT / "evidence/analysis/consolidated-dataset.json"
    if not path.exists():
        path = ROOT / "evidence/groups/all_8_completed_trials.json"
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    trials = [t for t in data["trials"] if t.get("endReason") == "completed" and t.get("durationSec", 0) >= 89.75 and not t.get("errors")]
    return trials

def get_pulse_values(trial):
    """Extract post-warmup (>=12s) valid pulse measurements."""
    samples = trial.get("samples", [])
    return [s["value"] for s in samples if isinstance(s, dict)
            and isinstance(s.get("value"), (int, float)) and math.isfinite(s["value"])
            and 12 <= s.get("elapsedSec", 0) <= trial["durationSec"] and s["value"] > 0]

def analyze_sessions():
    trials = load_completed_trials()
    
    participants = {}
    for t in trials:
        p_id = (t.get("ml") or {}).get("participantId") or "unknown"
        participants.setdefault(p_id, []).append(t)
        
    summary = {
        "schema": "spooflab-session-eval-v1",
        "total_completed_trials": len(trials),
        "participants": {},
        "analysis_type": "descriptive_within_participant_comparison",
        "limitations": [
            "This report does not train a model or evaluate predictions on held-out sessions.",
            "Reported means and SDs pool SDK estimates; repeated estimates are not independent observations.",
            "Same participant and adjacent capture times do not establish synchronized source-recording pairs.",
            "No equivalence threshold was preregistered. A small mean difference does not establish accuracy, equivalence or live presence.",
            "Validation warnings and capture conditions must be reviewed in the original trial evidence."
        ]
    }
    
    print("\n" + "=" * 70)
    print("SPOOFLAB SESSION-BASED PHYSIOLOGICAL EVALUATION (H1)")
    print("=" * 70)
    
    for pid, ptrials in sorted(participants.items()):
        live_trials = [t for t in ptrials if t["condition"] == "live"]
        replay_trials = [t for t in ptrials if t["condition"] == "screen_replay"]
        
        live_pulses = [p for t in live_trials for p in get_pulse_values(t)]
        replay_pulses = [p for t in replay_trials for p in get_pulse_values(t)]
        
        live_mean = float(np.mean(live_pulses)) if live_pulses else None
        live_std = float(np.std(live_pulses)) if len(live_pulses) > 1 else None
        replay_mean = float(np.mean(replay_pulses)) if replay_pulses else None
        replay_std = float(np.std(replay_pulses)) if len(replay_pulses) > 1 else None
        
        diff = (replay_mean - live_mean) if (live_mean is not None and replay_mean is not None) else None
        
        p_summary = {
            "participant": pid,
            "live": {
                "trials_count": len(live_trials),
                "trial_ids": [t["trialId"][:8] for t in live_trials],
                "sample_count": len(live_pulses),
                "mean_bpm": round(live_mean, 2) if live_mean else None,
                "std_bpm": round(live_std, 2) if live_std else None,
            },
            "replay": {
                "trials_count": len(replay_trials),
                "trial_ids": [t["trialId"][:8] for t in replay_trials],
                "sample_count": len(replay_pulses),
                "mean_bpm": round(replay_mean, 2) if replay_mean else None,
                "std_bpm": round(replay_std, 2) if replay_std else None,
            },
            "paired_comparison": {
                "comparison_type": "same_participant_condition_means_not_time_paired",
                "bpm_difference_replay_minus_live": round(diff, 2) if diff is not None else None,
                "relative_difference_pct": round(abs(diff) / live_mean * 100, 2) if (diff is not None and live_mean) else None
            }
        }
        summary["participants"][pid] = p_summary
        
        print(f"\nParticipant: {pid}")
        if live_mean is not None:
            print(f"  Live:   n={len(live_trials)} trials ({len(live_pulses)} samples) | Mean: {live_mean:.1f} BPM (SD {live_std:.1f})")
        else:
            print(f"  Live:   No live trials")
            
        if replay_mean is not None:
            print(f"  Replay: n={len(replay_trials)} trials ({len(replay_pulses)} samples) | Mean: {replay_mean:.1f} BPM (SD {replay_std:.1f})")
        else:
            print(f"  Replay: No replay trials")
            
        if diff is not None:
            print(f"  -> Difference of pooled SDK estimate means (Replay - Live): {diff:+.2f} BPM ({p_summary['paired_comparison']['relative_difference_pct']}%)")
            print("  -> Descriptive observation only; equivalence and measurement accuracy are not established.")
            
    out_path = ROOT / "evidence/analysis/session-evaluation.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\nSaved session evaluation to: {out_path.relative_to(ROOT)}")
    print("=" * 70)
    return summary

if __name__ == "__main__":
    analyze_sessions()
