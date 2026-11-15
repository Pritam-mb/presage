// Renders docs/POST.template.md -> docs/POST.md, replacing {{summary.path.to.value}} from evidence/summary.json. Fails on unknown tokens.
const fs = require('fs'), path = require('path');
const root = process.cwd(), s = JSON.parse(fs.readFileSync(path.join(root, 'evidence', 'summary.json'), 'utf8'));
const tpl = fs.readFileSync(path.join(root, 'docs', 'POST.template.md'), 'utf8'); const missing = [];
const out = tpl.replace(/\{\{\s*summary\.([\w.]+)\s*\}\}/g, (m, p) => { const v = p.split('.').reduce((o, k) => (o == null ? o : o[k]), s); if (v === undefined || v === null) { missing.push(p); return m; } return Array.isArray(v) ? v.join(' to ') : String(v); });
fs.writeFileSync(path.join(root, 'docs', 'POST.md'), out);
if (missing.length) { console.error('Unresolved tokens:', missing.join(', ')); process.exit(1); }
console.log('post built');

