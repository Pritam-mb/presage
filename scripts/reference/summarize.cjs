// Builds evidence/summary.json from evidence/real/trials/*.json ONLY. Run: node scripts/summarize.cjs
const fs = require('fs'), path = require('path');
const dir = path.join(process.cwd(), 'evidence', 'real', 'trials');
const trials = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const C = ['live', 'photo', 'screen_replay', 'injected_replay'];
function wilson(k, n, z = 1.96) { if (!n) return [null, null]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [+((c - m) / d).toFixed(3), +((c + m) / d).toFixed(3)]; }
const mean = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null;
const sd = a => a.length > 1 ? +Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1)).toFixed(2) : null;
const out = { generated_at: new Date().toISOString(), total_trials: trials.length, inconclusive_count: trials.filter(t => t.outcome === 'inconclusive').length, by_condition: {}, per_condition: {} };
for (const c of C) {
  const ts = trials.filter(t => t.condition === c);
  const conclusive = ts.filter(t => t.outcome !== 'inconclusive');
  const acc = conclusive.filter(t => t.gate && t.gate.accepted).length;
  const bpm = conclusive.map(t => t.metrics && t.metrics.pulse_mean_bpm).filter(v => typeof v === 'number' && v > 0);
  out.by_condition[c] = ts.length;
  out.per_condition[c] = { n: ts.length, conclusive: conclusive.length, inconclusive: ts.length - conclusive.length, gate_accepted: acc, gate_acceptance_rate: conclusive.length ? +(acc / conclusive.length).toFixed(3) : null, gate_acceptance_wilson95: wilson(acc, conclusive.length), pulse_mean_bpm: mean(bpm), pulse_sd_bpm: sd(bpm) };
}
fs.writeFileSync(path.join(process.cwd(), 'evidence', 'summary.json'), JSON.stringify(out, null, 2));
console.log('summary written:', JSON.stringify(out.by_condition));

