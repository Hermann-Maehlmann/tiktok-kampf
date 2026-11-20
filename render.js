// usage: FIGHT=build/<id>/fight.json node render.js outdir fps i0 i1   |  node render.js outdir stills t1 t2 ...
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const root = __dirname;
const types = { '.js': 'text/javascript', '.html': 'text/html', '.otf': 'font/otf', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const port = srv.address().port;
  const [out, mode, ...rest] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  // on a Mac the GPU is used; in the cloud (no GPU) software WebGL
  const b = await chromium.launch({ args: process.platform === 'darwin' ? ['--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('console', m => console.log('console:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(`http://localhost:${port}/index.html?fight=${encodeURIComponent('/' + (process.env.FIGHT || 'fights/v3.json'))}`);
  await p.waitForFunction('window.READY', null, { timeout: 120000 });
  let jobs;
  if (mode === 'stills') jobs = rest.map(t => [Number(t), `t${Number(t).toFixed(2)}.jpg`]);
  else { const fps = +mode, i0 = +rest[0], i1 = +rest[1]; jobs = []; for (let i = i0; i < i1; i++) jobs.push([i / fps, `${String(i).padStart(5, '0')}.jpg`]); }
  const t0 = Date.now();
  for (const [t, name] of jobs) {
    const url = await p.evaluate(t => window.frame(t), t);
    fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('done', jobs.length, 'frames', ((Date.now() - t0) / jobs.length).toFixed(0), 'ms/frame');
  await b.close(); srv.close();
});
