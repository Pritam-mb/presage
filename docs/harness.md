# SpoofLab Workflow and Harness

The goal is a project that is **done because evidence says so**, not because an assistant said so. This file defines the gates, the harness that checks them, and the loop a coding agent must follow.

## Why a harness

In this project, tools twice reported "all verified" while numbers were stale, a table counted block pages as content, and a chart was a conceptual animation. The harness removes that failure mode: every hard gate is a machine check, real-world evidence must exist as files with provenance, and the post is generated from the data.

**What the harness can and cannot do.** It checks code health, file contracts, secrets, claim wording, evidence completeness, and consistency. It cannot prove a video shows what it claims or that a trial was run honestly. Those are human attestations (see the manual gates).

## Folder layout

```
D:\prestige\
  scripts\harness.cjs            # the gate runner (below)
  scripts\summarize.cjs          # evidence/real/trials/*.json -> evidence/summary.json
  scripts\build-post.cjs         # docs/POST.template.md -> docs/POST.md using summary tokens
  evidence\real\camera_fps.json # written by the app's camera diagnostic (synthetic:false)
  evidence\real\trials\*.json   # one per real trial, schema spooflab.trial.v2
  evidence\summary.json          # generated, never hand-edited
  fixtures\                      # synthetic data for tests only (synthetic:true)
  docs\SUBMISSION.md  docs\POST.template.md  docs\POST.md  docs\ORIGINALITY.md  docs\submission.json
  HARNESS_STATUS.md harness-report.json   # written by each run
```

Add to `package.json`:

```json
"scripts": {
  "summarize": "node scripts/summarize.cjs",
  "post": "node scripts/build-post.cjs",
  "harness": "node scripts/harness.cjs",
  "harness:final": "node scripts/harness.cjs --final"
}
```

## Gates

| Gate | Check | Type | Who produces the evidence |
|---|---|---|---|
| G0 | `.env` and artifacts ignored, LICENSE present, no `.env` value or key-like string in any file | auto | agent |
| G1 | `npm run check`, `npm test`, `npm run build` pass | auto | agent |
| G2 | `evidence/real/camera_fps.json` shows delivered FPS >= 25 over >= 6 s, `synthetic:false` | auto | you run the in-app diagnostic |
| G3 | Real trials meet the minimum matrix (live 3, photo 2, screen replay 3, injected replay 3), schema-valid, consented, no identifiers, at least one 60 s+ live `signal_observed`, inconclusives counted, `summary.json` matches a recomputation | auto | you run trials, the app exports |
| G4 | No unqualified liveness, deepfake, "secure authentication", SDK-vulnerability, diagnosis or medical claims anywhere in docs or UI text | auto | agent |
| G5 | README or SUBMISSION covers consent, storage, sharing, retention, deletion, telemetry, AI services, setup; post has no unresolved tokens and stays `published:false` until final; at `--final`: `submission.json` complete, `ORIGINALITY.md` written | auto | agent and you |
| G6 | Time left to the deadline (soft warning under 24 h) | soft | clock |

### Manual gates (attestations you sign in `docs/SUBMISSION.md`)

- **M1 Consent review:** a second person reads the consent screen and your consent section and says whether it is clear.
- **M2 Presage privacy page:** the Telemetry and Privacy page is quoted in the README, with its URL and the date you read it.
- **M3 Live-signal video:** the demo video visibly shows a live camera trial with pulse or breathing values changing. Set `video_shows_live_signal` in `docs/submission.json` to true **only if** you watched the finished video and saw it.
- **M4 Originality re-scan within 48 h of submitting:** search the challenge tag and compare against existing entries, including Proof of Breath, Aegis Pulse, Orbura, Stillpoint, Breathe Together and Ad Pulse Lab. Write findings in `docs/ORIGINALITY.md`.
- **M5 Proofread and numbers:** every number in the post comes from a `{{summary.*}}` token, and you opened `summary.json` and confirmed three of them by hand.

## The agent loop (paste this to your coding agent)

```
You are working in D:\prestige on SpoofLab. Goal: make `node scripts/harness.cjs --final`
exit 0 WITHOUT fabricating evidence.

Rules:
1. Start every session by reading HANDOFF.md and HARNESS_STATUS.md. Do not ask for the API key;
   never print, log, copy or commit .env values.
2. Loop: run `node scripts/harness.cjs`; read HARNESS_STATUS.md; take the first failing HARD gate.
3. If the gate needs real-world evidence (camera diagnostic, trials, video, consent review,
   originality scan), STOP and tell me exactly what to do next. Never create, edit or
   backfill files under evidence/real/. Never mark synthetic data as real.
4. Otherwise fix the code or docs, rerun the harness, and repeat.
5. Never change harness thresholds, the frozen QualityGate thresholds, or the claim lists to
   make a gate pass. If a rule looks wrong, explain why and ask me.
6. Never describe a replay as an SDK vulnerability or the tool as a liveness verifier.
7. After 5 iterations, or when only human-evidence gates remain, stop and report: which gates
   pass, which fail, what you changed, and the next human action. Do not claim "done" unless
   the final harness run printed ALL HARD GATES PASS.
```

## Daily routine

1. `npm run harness` and read `HARNESS_STATUS.md`.
2. Do the next human-evidence step (camera, trials, video).
3. `npm run summarize`, then `npm run post`, then `npm run harness` again.
4. Before submitting: `npm run harness:final` must print `ALL HARD GATES PASS`, then complete M1 to M5.

## Known limits of the checks

- Secret scanning only looks for exact `.env` values and common key-like patterns. Review `git status` before every push.
- The claim scan flags lines unless they also contain a negation word (not, never, without, cannot, and similar). It is a tripwire, not a judge. Read what it flags.
- It cannot detect fabricated trial files that follow the schema. Honesty is part of the process: trials come from the app's export, with timestamps and FPS evidence you can show.

## `scripts/harness.cjs`

Tested against a mock project: it fails on missing evidence, synthetic flags, forbidden identifier keys, leaked `.env` values and unqualified claims, and passes on a valid evidence set.

```js
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

```

## `scripts/summarize.cjs`

```js
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

```

## `scripts/build-post.cjs`

Write `docs/POST.template.md` with tokens like `{{summary.by_condition.live}}` or `{{summary.per_condition.live.gate_acceptance_wilson95}}`. The build fails if any token is unresolved.

```js
// Renders docs/POST.template.md -> docs/POST.md, replacing {{summary.path.to.value}} from evidence/summary.json. Fails on unknown tokens.
const fs = require('fs'), path = require('path');
const root = process.cwd(), s = JSON.parse(fs.readFileSync(path.join(root, 'evidence', 'summary.json'), 'utf8'));
const tpl = fs.readFileSync(path.join(root, 'docs', 'POST.template.md'), 'utf8'); const missing = [];
const out = tpl.replace(/\{\{\s*summary\.([\w.]+)\s*\}\}/g, (m, p) => { const v = p.split('.').reduce((o, k) => (o == null ? o : o[k]), s); if (v === undefined || v === null) { missing.push(p); return m; } return Array.isArray(v) ? v.join(' to ') : String(v); });
fs.writeFileSync(path.join(root, 'docs', 'POST.md'), out);
if (missing.length) { console.error('Unresolved tokens:', missing.join(', ')); process.exit(1); }
console.log('post built');

```