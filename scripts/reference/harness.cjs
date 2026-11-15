#!/usr/bin/env node
// SpoofLab harness. Zero dependencies. Run: node scripts/harness.cjs [--final] [--skip-run]
// Exit code 0 only if every HARD gate passes. Writes HARNESS_STATUS.md and harness-report.json.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = process.cwd();
const FINAL = process.argv.includes('--final');
const SKIP_RUN = process.argv.includes('--skip-run');
const DEADLINE_UTC = Date.parse('2026-11-23T07:59:00Z');          // Nov 22, 11:59 PM PST (verify on the contest page)
const INTERNAL_UTC = Date.parse('2026-11-22T06:30:00Z');          // Nov 22, 12:00 IST: your own earlier cutoff
const MIN = { live: 3, photo: 2, screen_replay: 3, injected_replay: 3 };
const CONDITIONS = Object.keys(MIN);
const SKIP_DIRS = new Set(['node_modules', '.git', 'artifacts', 'dist', 'build', 'evidence']);
const results = [];
const add = (id, name, hard, ok, detail) => results.push({ id, name, hard, ok: !!ok, detail: detail || '' });
const exists = p => fs.existsSync(path.join(ROOT, p));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const textFiles = () => walk(ROOT).filter(f => /\.(md|js|cjs|mjs|ts|tsx|html|css|json|txt|yml|yaml|example)$/i.test(f) && !/package-lock\.json$/.test(f));
function run(cmd) {
  const r = cp.spawnSync(cmd, { shell: true, cwd: ROOT, encoding: 'utf8' });
  return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).slice(-400) };
}

// G0 hygiene
(function () {
  const gi = exists('.gitignore') ? read('.gitignore') : '';
  add('G0.1', '.env and artifacts are git-ignored', true, /^\.env$/m.test(gi) && /artifacts/.test(gi), 'check .gitignore');
  add('G0.2', 'LICENSE present', true, exists('LICENSE'));
  let leak = [];
  if (exists('.env')) {
    const vals = read('.env').split(/\r?\n/).map(l => l.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')).filter(v => v.length >= 12);
    for (const f of textFiles()) { const t = fs.readFileSync(f, 'utf8'); if (vals.some(v => t.includes(v))) leak.push(path.relative(ROOT, f)); }
  }
  add('G0.3', 'No .env secret value appears in any other file', true, leak.length === 0, leak.join(', '));
  const pat = /(api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{24,}["']/i;
  const hits = textFiles().filter(f => !/\.env\.example$/.test(f) && pat.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(ROOT, f));
  add('G0.4', 'No hard-coded key-like strings', true, hits.length === 0, hits.join(', '));
})();

// G1 code health
if (!SKIP_RUN) for (const [id, name, cmd] of [['G1.1', 'syntax/check', 'npm run check'], ['G1.2', 'unit tests', 'npm test'], ['G1.3', 'build', 'npm run build']]) {
  const r = run(cmd); add(id, name, true, r.ok, r.ok ? '' : r.out);
}

// evidence loading
const trialDir = path.join(ROOT, 'evidence', 'real', 'trials');
const trials = [], bad = [];
if (fs.existsSync(trialDir)) for (const f of fs.readdirSync(trialDir).filter(f => f.endsWith('.json'))) {
  try { trials.push({ f, t: JSON.parse(fs.readFileSync(path.join(trialDir, f), 'utf8')) }); } catch (e) { bad.push(f + ': unreadable JSON'); }
}
const REQ = ['schema', 'trial_id', 'synthetic', 'sdk', 'started_at', 'ended_at', 'duration_s', 'condition', 'source', 'consent', 'camera', 'protocol', 'outcome', 'metrics'];
const FORBIDDEN_KEYS = /^(deviceid|device_id|devicelabel|label|apikey|api_key|filepath|path)$/i;
function scanKeys(o, p, f) { if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (FORBIDDEN_KEYS.test(k)) bad.push(`${f}: forbidden key ${p}${k}`); scanKeys(o[k], p + k + '.', f); } }
for (const { f, t } of trials) {
  const miss = REQ.filter(k => !(k in t));
  if (miss.length) bad.push(`${f}: missing ${miss.join(',')}`);
  if (t.schema !== 'spooflab.trial.v2') bad.push(`${f}: schema`);
  if (t.synthetic !== false) bad.push(`${f}: synthetic must be false in evidence/real`);
  if (!t.sdk || !t.sdk.version) bad.push(`${f}: sdk.version`);
  if (!CONDITIONS.includes(t.condition)) bad.push(`${f}: condition`);
  if (!(Date.parse(t.ended_at) > Date.parse(t.started_at))) bad.push(`${f}: time order`);
  if (!t.consent || t.consent.subject_consented !== true) bad.push(`${f}: consent`);
  if (t.condition === 'live' && !(t.camera && t.camera.delivered_fps >= 25)) bad.push(`${f}: live trial below 25 FPS`);
  if (!['signal_observed', 'no_signal', 'inconclusive'].includes(t.outcome)) bad.push(`${f}: outcome`);
  scanKeys(t, '', f);
}
add('G2.1', 'Camera diagnostic evidence shows >= 25 FPS', true, (() => { try { const c = JSON.parse(read('evidence/real/camera_fps.json')); return c.synthetic === false && c.delivered_fps >= 25 && c.duration_s >= 6; } catch (e) { return false; } })(), 'evidence/real/camera_fps.json');
add('G2.2', 'Trial files are valid, real, consented, and contain no identifiers', true, bad.length === 0 && trials.length > 0, bad.slice(0, 6).join(' | '));
const counts = Object.fromEntries(CONDITIONS.map(c => [c, trials.filter(x => x.t.condition === c).length]));
add('G3.1', `Minimum real trials per condition (${JSON.stringify(MIN)})`, true, CONDITIONS.every(c => counts[c] >= MIN[c]), JSON.stringify(counts));
add('G3.2', 'At least one completed live trial with signal_observed', true, trials.some(x => x.t.condition === 'live' && x.t.outcome === 'signal_observed' && x.t.duration_s >= 60));
add('G3.3', 'Inconclusive trials are reported, not dropped (summary lists them)', true, (() => { try { const s = JSON.parse(read('evidence/summary.json')); return typeof s.inconclusive_count === 'number' && s.inconclusive_count === trials.filter(x => x.t.outcome === 'inconclusive').length; } catch (e) { return false; } })());
add('G3.4', 'summary.json matches a fresh recomputation', true, (() => { try { const s = JSON.parse(read('evidence/summary.json')); return s.total_trials === trials.length && CONDITIONS.every(c => s.by_condition && s.by_condition[c] === counts[c]); } catch (e) { return false; } })());

// G4 claim hygiene
(function () {
  const strict = /(proves? liveness|detects? deepfakes?|secure authentication|sdk vulnerability|anti-?spoof guarantee|unspoofable)/i;
  const soft = /\b(diagnos\w*|treatment|medical advice|stress level|anxiety|clinical)\b/i;
  const neg = /\b(no|not|never|without|cannot|can't|isn't|does not|do not|must not|avoid|prohibited|excluded)\b/i;
  const flags = [];
  for (const f of textFiles().filter(f => /\.(md|html|js|cjs)$/i.test(f) && !/harness\.cjs$|WORKFLOW|HARNESS/.test(f))) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => { if ((strict.test(l) || soft.test(l)) && !neg.test(l)) flags.push(`${path.relative(ROOT, f)}:${i + 1}`); });
  }
  add('G4.1', 'No unqualified liveness/diagnosis/medical claims', true, flags.length === 0, flags.slice(0, 8).join(', '));
})();

// G5 consent and submission completeness
(function () {
  const readme = exists('README.md') ? read('README.md').toLowerCase() : '';
  const sub = exists('docs/SUBMISSION.md') ? read('docs/SUBMISSION.md').toLowerCase() : '';
  const all = readme + '\n' + sub;
  const need = ['consent', 'storage', 'sharing', 'retention', 'deletion', 'telemetry', 'ai service', 'setup'];
  const miss = need.filter(k => !all.includes(k));
  add('G5.1', 'README/SUBMISSION cover consent, storage, sharing, retention, deletion, telemetry, AI services, setup', true, miss.length === 0, miss.join(', '));
  let meta = null; try { meta = JSON.parse(read('docs/submission.json')); } catch (e) {}
  add('G5.2', 'submission.json has repo, video, post URLs (final only)', FINAL, !!meta && !!meta.repo_url && !!meta.demo_video_url && !!meta.post_url && meta.video_shows_live_signal === true, 'docs/submission.json');
  add('G5.3', 'Originality scan recorded (date + entries compared)', FINAL, exists('docs/ORIGINALITY.md') && /proof of breath/i.test(read('docs/ORIGINALITY.md')), 'docs/ORIGINALITY.md must compare against existing entries');
  const post = exists('docs/POST.md') ? read('docs/POST.md') : '';
  add('G5.4', 'Post has no unresolved {{tokens}} and keeps published:false until final', true, !/\{\{[^}]+\}\}/.test(post) && (FINAL || /published:\s*false/.test(post) || post === ''), 'docs/POST.md');
})();

// G6 time
const now = Date.now(), hrs = (DEADLINE_UTC - now) / 36e5;
add('G6.1', `Time left to contest deadline: ${hrs.toFixed(1)} h (internal cutoff in ${((INTERNAL_UTC - now) / 36e5).toFixed(1)} h)`, false, hrs > 24);

const hardFail = results.filter(r => r.hard && !r.ok);
const lines = ['# HARNESS STATUS', '', `Run: ${new Date().toISOString()}  |  mode: ${FINAL ? 'FINAL' : 'working'}`, '', '| Gate | Check | Type | Result | Detail |', '|---|---|---|---|---|'];
for (const r of results) lines.push(`| ${r.id} | ${r.name.replace(/\|/g, '/')} | ${r.hard ? 'hard' : 'soft'} | ${r.ok ? 'PASS' : 'FAIL'} | ${String(r.detail).replace(/\s+/g, ' ').slice(0, 140).replace(/\|/g, '/')} |`);
lines.push('', hardFail.length ? `NOT DONE: ${hardFail.length} hard gate(s) failing.` : 'ALL HARD GATES PASS.');
fs.writeFileSync(path.join(ROOT, 'HARNESS_STATUS.md'), lines.join('\n'));
fs.writeFileSync(path.join(ROOT, 'harness-report.json'), JSON.stringify({ at: new Date().toISOString(), final: FINAL, results }, null, 2));
console.log(lines.join('\n'));
process.exit(hardFail.length ? 1 : 0);

