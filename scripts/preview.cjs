const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function startServer(port = 4173) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.writeHead(302, { Location: '/src/index.html' }); res.end(); return; }
    const name = url.pathname;
    // Serve only public UI files; never expose reports, keys, dotfiles or dependencies.
    if (!/^\/(src\/(index\.html|style\.css|theme\.css|ml\.css|ml-ui\.js|arena\.js|policies\.cjs|camera\.cjs|evidence\.cjs|renderer\.js|protocol\.cjs|reports\.cjs)|dist\/sdk\.js)$/.test(name)) { res.writeHead(404); res.end('Not found'); return; }
    const file = path.join(root, name);
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end('Not built'); return; }
      res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.css') ? 'text/css' : 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); });
}
if (require.main === module) startServer().then(server => console.log(`SpoofLab report workspace: http://127.0.0.1:${server.address().port}\nLive SDK capture requires npm start (Electron).`)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { startServer };
