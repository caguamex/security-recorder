// Graba un video de demostración agendando una cita en Ritmo Belleza.
// Uso: node ritmo/herramientas/empaquetar.mjs && node ritmo/herramientas/video-demo.mjs
// Requiere Playwright (Chromium) y ffmpeg. Resultado: ritmo/imagenes/demo-agendar-cita.mp4
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = pathToFileURL(join(raiz, 'dist', 'belleza.html')).href;
const salida = join(raiz, 'imagenes', 'demo-agendar-cita.mp4');
const tmp = mkdtempSync(join(tmpdir(), 'ritmo-video-'));
const W = 390, H = 844;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: false,
  timezoneId: 'America/Mexico_City', locale: 'es-MX',
});
const p = await ctx.newPage();
// Captura de pantalla continua a resolución de teléfono (2x) con las marcas de tiempo de Chromium
const cdp = await ctx.newCDPSession(p);
const frames = [];
cdp.on('Page.screencastFrame', f => { frames.push({ data: f.data, t: f.metadata.timestamp }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
await p.clock.setFixedTime(new Date('2026-10-27T09:30:00-06:00'));
// Dedo visible y subtítulos de cada paso
await p.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = `#dedo{position:fixed;z-index:99;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(0,0,0,.18);border:2px solid rgba(255,255,255,.9);box-shadow:0 2px 10px rgba(0,0,0,.25);pointer-events:none;transition:transform .12s;left:-60px;top:-60px}
      #dedo.on{transform:scale(.75);background:rgba(0,122,255,.35)}
      #paso{position:fixed;z-index:98;left:12px;right:12px;top:10px;padding:10px 14px;border-radius:14px;background:rgba(20,20,24,.86);color:#fff;font:600 15px/1.3 Inter,system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .3s;pointer-events:none}
      #paso.on{opacity:1}`;
    document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'dedo'; document.body.appendChild(d);
    const s = document.createElement('div'); s.id = 'paso'; document.body.appendChild(s);
    addEventListener('mousemove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => d.classList.add('on'), true);
    addEventListener('mouseup', () => d.classList.remove('on'), true);
  });
});
await p.goto(app);
await p.evaluate(() => document.fonts.ready);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });

const espera = ms => p.waitForTimeout(ms);
const paso = async t => { await p.evaluate(t => { const s = document.getElementById('paso'); s.textContent = t; s.classList.toggle('on', !!t); }, t); };
let pos = { x: W / 2, y: H - 40 };
async function toca(sel, pausa = 700) {
  const el = p.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await p.mouse.move(pos.x, pos.y);
  await p.mouse.move(x, y, { steps: 18 });
  pos = { x, y };
  await espera(200);
  await p.mouse.down(); await espera(120); await p.mouse.up();
  await espera(pausa);
}
async function escribe(sel, texto) {
  await toca(sel, 200);
  await p.keyboard.type(texto, { delay: 85 });
  await espera(400);
}

await espera(600);
await paso('Así se ve tu agenda del día');
await espera(2200);
await paso('1 · Toca + para agendar una cita');
await espera(1200);
await toca('#fab', 1000);
await paso('2 · Elige a la clienta o crea una nueva');
await espera(800);
await p.selectOption('#c-cli', '__nueva');
await espera(600);
await escribe('#c-nombre', 'Valeria Méndez');
await escribe('#c-tel', '55 2345 6789');
await paso('3 · Elige el servicio');
await toca('[data-svc="es6"]', 900);
await paso('4 · Elige un horario libre');
await p.locator('#c-slots').scrollIntoViewIfNeeded();
await espera(700);
await toca('[data-slot="13:00"]', 900);
await paso('5 · Agenda y envía la confirmación');
await p.locator('#c-go').scrollIntoViewIfNeeded();
await espera(900);
await toca('#c-go', 1200);
await paso('El mensaje de WhatsApp ya va escrito');
await espera(2600);
await toca('[data-close]', 1000);
await paso('La cita ya está en tu agenda');
await espera(1600);
await toca('[data-cita]:has-text("Valeria")', 1000);
await paso('6 · Cuando te confirme, márcala como confirmada');
await espera(1000);
await toca('[data-estado="confirmada"]', 1400);
await paso('Listo: cita agendada y confirmada ✓');
await espera(2600);
await paso('');
await espera(400);

await cdp.send('Page.stopScreencast');
await ctx.close();
await browser.close();
// Cada cuadro dura hasta que llega el siguiente
const lista = ['ffconcat version 1.0'];
frames.forEach((f, i) => {
  const nombre = `f${String(i).padStart(5, '0')}.jpg`;
  writeFileSync(join(tmp, nombre), Buffer.from(f.data, 'base64'));
  const dur = i + 1 < frames.length ? Math.max(0.01, frames[i + 1].t - f.t) : 0.5;
  lista.push(`file ${nombre}`, `duration ${dur.toFixed(3)}`);
});
lista.push(`file f${String(frames.length - 1).padStart(5, '0')}.jpg`);
writeFileSync(join(tmp, 'lista.txt'), lista.join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(tmp, 'lista.txt'), '-vf', 'fps=30,scale=780:-2:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', salida]);
rmSync(tmp, { recursive: true, force: true });
console.log('Listo:', salida);
