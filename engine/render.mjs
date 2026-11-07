// Video Fabrikası — render motoru
// Kullanım: node engine/render.mjs --series quiz --item content/quiz/q001.json --seed 7 --out out/x.mp4
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname } from 'node:path';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => {
    const [k, ...v] = s.trim().split(' ');
    return [k, v.join(' ')];
  })
);
const series = args.series;
const item = JSON.parse(readFileSync(resolve(args.item), 'utf8'));
const seed = Number(args.seed ?? Date.now() % 100000);
const out = resolve(args.out ?? `out/${series}-${item.id}-${seed}.mp4`);
const history = args.history ? JSON.parse(readFileSync(resolve(args.history), 'utf8')) : [];
const FPS = 30, W = 1080, H = 1920;
const preview = 'preview' in args; // hızlı test: yarı çözünürlük
mkdirSync(dirname(out), { recursive: true });

// yerel statik sunucu (ES modülleri file:// ile yüklenmiyor)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const f = resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: preview ? 0.5 : 1 });
page.on('console', m => { if (m.type() === 'error') console.error('[sayfa]', m.text()); });
page.on('pageerror', e => console.error('[sayfa hata]', e.message));
await page.goto(`${BASE}/series/${series}/index.html`);
await page.waitForFunction(() => window.SERIES && window.SERIES.ready);

const plan = await page.evaluate(async ([item, seed, history]) => await window.SERIES.setup(item, seed, history), [item, seed, history]);
const frames = Math.round(plan.duration * FPS);
console.log(`▶ ${series}/${item.id} seed=${seed} süre=${plan.duration.toFixed(1)}sn kare=${frames}`);
console.log('  yönetmen:', JSON.stringify(plan.director));

const silent = out.replace(/\.mp4$/, '.silent.mp4');
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-vf', `scale=${W}:${H}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent],
  { stdio: ['pipe', 'inherit', 'inherit'] });

const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await page.evaluate(t => window.SERIES.frame(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 60 === 0) process.stdout.write(`\r  kare ${i}/${frames}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
server.close();
console.log(`\r  görüntü bitti (${((Date.now() - t0) / 1000).toFixed(0)} sn)`);

// Ses: müzik + efektler
const cueFile = out.replace(/\.mp4$/, '.cues.json');
writeFileSync(cueFile, JSON.stringify({ duration: plan.duration, seed, music: plan.music, cues: plan.cues }));
const wav = out.replace(/\.mp4$/, '.wav');
execFileSync('python3', [resolve(ROOT, 'engine/audio.py'), cueFile, wav], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
execFileSync('rm', ['-f', silent, wav, cueFile]);
writeFileSync(out.replace(/\.mp4$/, '.meta.json'), JSON.stringify({ id: item.id, series, seed, director: plan.director, duration: plan.duration }, null, 2));
console.log('✓', out);
