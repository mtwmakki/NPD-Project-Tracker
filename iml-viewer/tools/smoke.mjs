/**
 * Headless smoke test for the IML container viewer.
 *   node tools/smoke.mjs            (expects a server on :8099 serving iml-viewer/)
 * Verifies: the page boots, WebGL paints a non-blank frame, the flat-pattern
 * maths closes, the label projection lights up, and the die-line SVG is valid XML.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const URL = process.env.SMOKE_URL || 'http://127.0.0.1:8099/index.html';
const out = [];
const ok   = (n, d = '') => { out.push(`  PASS  ${n}${d ? '  — ' + d : ''}`); };
const bad  = (n, d = '') => { out.push(`  FAIL  ${n}${d ? '  — ' + d : ''}`); process.exitCode = 1; };

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Fonts are cosmetic and unreachable from a sandbox; block anything off-host
// so the test measures the app rather than the network.
await page.route('**', r => r.request().url().startsWith('http://127.0.0.1') ? r.continue() : r.abort());

const errors = [];
const local = u => !u || u.startsWith('http://127.0.0.1');
page.on('console', m => { if (m.type() === 'error' && local(m.location().url)) errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });

// 1 — boots
try {
  await page.waitForSelector('#boot.gone', { timeout: 20000 });
  ok('page boots');
} catch { bad('page boots', 'boot overlay never cleared'); }

const errShown = await page.locator('#err.on').count();
if (errShown) bad('no fatal error', await page.locator('#err-m').textContent());
else ok('no fatal error');

// 2 — catalogue populated
const cards = await page.locator('#rail-list .card').count();
cards >= 4 ? ok('catalogue loaded', `${cards} SKUs`) : bad('catalogue loaded', `only ${cards} cards`);

// 3 — WebGL actually painted something.
//     A WebGL canvas reads back blank once the frame is composited, so probe
//     the drawing buffer directly, in the same turn as the render.
await page.waitForTimeout(1200);
// Stop the turntable so every probe sees the same pose — a spinning part makes
// pixel counts drift run to run and the assertions meaningless.
await page.evaluate(() => { window.__iml.state.spin = false; });
await page.waitForTimeout(200);
const PROBE = `(() => {
  const { renderer, scene, camera } = window.__iml;
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let min = 255, max = 0, chroma = 0, lit = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i+1], b = px[i+2];
    const l = (r + g + b) / 3;
    if (l < min) min = l;
    if (l > max) max = l;
    if (l > 60) lit++;
    // The bare part and the studio sweep are neutral greys; the test artwork is
    // strongly coloured, so saturated pixels can only come from the label.
    if (Math.max(r, g, b) - Math.min(r, g, b) > 45) chroma++;
  }
  return { min, max, range: max - min, chroma, lit, total: w * h, w, h };
})()`;
const frame = await page.evaluate(PROBE);
frame.range > 25
  ? ok('WebGL frame rendered', `${frame.w}x${frame.h}, luma range ${frame.range.toFixed(0)}, ${(100*frame.lit/frame.total).toFixed(0)}% lit`)
  : bad('WebGL frame rendered', `frame looks flat (range ${frame.range.toFixed(0)})`);

// 4 — flat-pattern maths closes: arc length of the unrolled sector must
//     equal the container's circumference at both ends.
const maths = await page.evaluate(() => {
  const fp = window.__iml.flatPattern(41, 48, 68);
  const TAU = Math.PI * 2;
  return {
    theta: fp.theta,
    e1: Math.abs(fp.L1 * fp.theta - TAU * 41),
    e2: Math.abs(fp.L2 * fp.theta - TAU * 48),
    straight: window.__iml.flatPattern(40, 40, 60).straight
  };
});
(maths.e1 < 1e-9 && maths.e2 < 1e-9)
  ? ok('flat-pattern closes', `sector ${(maths.theta * 180 / Math.PI).toFixed(2)}°, residual < 1e-9 mm`)
  : bad('flat-pattern closes', `residuals ${maths.e1}, ${maths.e2}`);
maths.straight ? ok('straight wall degenerates to a rectangle') : bad('straight wall degenerates to a rectangle');

// 5 — label projection engages and changes the render
const chromaBefore = frame.chroma;
await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#0d47a1'; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = '#ffd54f';
  for (let i = 0; i < 8; i++) g.fillRect(i * 128, 0, 64, 512);
  g.fillStyle = '#fff'; g.font = 'bold 90px sans-serif';
  g.fillText('LABEL TEST', 180, 290);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  await window.__iml.setArtwork(new File([blob], 'test-artwork.png', { type: 'image/png' }));
});
await page.waitForTimeout(900);
const on = await page.evaluate(() => window.__iml.lblU.uLblOn.value);
on === 1 ? ok('label projection engaged') : bad('label projection engaged', `uLblOn=${on}`);

// The bare part and studio are neutral, so a jump in saturated pixels proves
// the projection actually reached the container surface.
const after = await page.evaluate(PROBE);
(after.chroma > 1000 && after.chroma > chromaBefore * 5)
  ? ok('label reaches the container surface', `${chromaBefore} → ${after.chroma} saturated pixels`)
  : bad('label reaches the container surface', `${chromaBefore} → ${after.chroma} saturated pixels`);

// Both artwork modes must sample differently on a tapered wall.
const modeShift = await page.evaluate(async P => {
  const g = m => { window.__iml.state.mode = m; window.__iml.lblU.uMode.value = m === 'arc' ? 1 : 0; };
  g('rect'); const a = eval(P).chroma;
  g('arc');  const b = eval(P).chroma;
  g('rect');
  return { a, b };
}, PROBE);
modeShift.a !== modeShift.b
  ? ok('rectangle and die-line modes differ', `${modeShift.a} vs ${modeShift.b} px`)
  : bad('rectangle and die-line modes differ', 'both modes sampled identically');

// 6 — die-line SVG is well-formed in both modes
{
  const svg = await page.evaluate(() => window.__iml.buildDielineSVG());
  const parsed = await page.evaluate(t => {
    const d = new DOMParser().parseFromString(t, 'image/svg+xml');
    return { err: !!d.querySelector('parsererror'), shapes: d.querySelectorAll('path,rect').length };
  }, svg);
  const arcs = (svg.match(/ A /g) || []).length;
  (!parsed.err && !/NaN|Infinity/.test(svg) && parsed.shapes >= 4 && arcs >= 6)
    ? ok('die-line SVG valid (tapered wall)', `${arcs} arc segments, ${svg.length} bytes`)
    : bad('die-line SVG valid (tapered wall)', `parsererror=${parsed.err} shapes=${parsed.shapes} arcs=${arcs}`);
  writeFileSync('/tmp/dieline-sample.svg', svg);

  // Every caption baseline must sit inside the viewBox, or the print shop
  // receives a template with its own instructions cropped off.
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const ys = [...svg.matchAll(/<text[^>]*\sy="([\d.]+)"/g)].map(m => +m[1]);
  const vh = vb ? +vb[2] : 0;
  (ys.length >= 5 && vh > 0 && Math.max(...ys) < vh && Math.min(...ys) > 0)
    ? ok('die-line captions fit the page', `${ys.length} lines, lowest ${Math.max(...ys).toFixed(1)} of ${vh.toFixed(1)} mm`)
    : bad('die-line captions fit the page', `lines=${ys.length} lowest=${Math.max(...ys)} viewBox height=${vh}`);

  // A straight wall must fall back to a plain rectangle die-line.
  const rectSvg = await page.evaluate(() => {
    const p = window.__iml.state.sku.parametric, keep = p.topDia;
    p.topDia = p.bottomDia;
    return window.__iml.selectSKU(window.__iml.state.sku).then(() => {
      const s = window.__iml.buildDielineSVG();
      p.topDia = keep;
      return s;
    });
  });
  (/ A /.test(rectSvg) === false && (rectSvg.match(/<rect/g) || []).length >= 4)
    ? ok('straight wall exports a rectangle die-line')
    : bad('straight wall exports a rectangle die-line', `arcs=${/ A /.test(rectSvg)}`);

  // that check mutated the SKU, so rebuild the real geometry before moving on
  await page.evaluate(() => window.__iml.selectSKU(window.__iml.state.sku));
  await page.waitForTimeout(400);
}

// 6b — the measured taper must match the declared dimensions.
//      This is the check that catches a flattened radius profile, which is
//      invisible on screen but silently ruins the die-line.
const taper = await page.evaluate(() => {
  const S = window.__iml.state, p = S.sku.parametric;
  if (!p) return null;
  const rb = p.bottomDia / 2, rt = p.topDia / 2;
  const yA = p.baseFillet, yB = p.height - p.rimThickness;
  const want = y => rb + (rt - rb) * (y - yA) / (yB - yA);
  const bg = window.__iml.bandGeometry();
  return {
    r1: bg.r1, r2: bg.r2, want1: want(S.label.yBottom), want2: want(S.label.yTop),
    straight: bg.fp.straight, deg: bg.fp.theta * 180 / Math.PI
  };
});
if (!taper) { ok('measured taper matches declared dimensions', 'skipped (CAD SKU)'); }
else {
  const e = Math.max(Math.abs(taper.r1 - taper.want1), Math.abs(taper.r2 - taper.want2));
  (!taper.straight && e < 0.1)
    ? ok('measured taper matches declared dimensions',
         `R ${taper.r1.toFixed(3)}→${taper.r2.toFixed(3)} mm (max error ${e.toFixed(4)} mm), sector ${taper.deg.toFixed(2)}°`)
    : bad('measured taper matches declared dimensions',
          `straight=${taper.straight} measured ${taper.r1.toFixed(3)}/${taper.r2.toFixed(3)} vs expected ${taper.want1.toFixed(3)}/${taper.want2.toFixed(3)}`);
}

// 7 — every catalogue SKU loads
const ids = await page.evaluate(() => window.__iml.state.catalog.products.map(p => p.id));
for (const id of ids) {
  await page.evaluate(i => window.__iml.selectSKU(window.__iml.state.catalog.products.find(p => p.id === i)), id);
  await page.waitForTimeout(350);
  const h = await page.evaluate(() => window.__iml.state.bbox ? window.__iml.state.bbox.max.y : 0);
  h > 10 ? ok(`SKU ${id} loads`, `height ${h.toFixed(1)} mm`) : bad(`SKU ${id} loads`, `height ${h}`);
}

await page.screenshot({ path: '/tmp/iml-viewer.png' });
errors.length ? bad('clean console', errors.slice(0, 4).join(' | ')) : ok('clean console');

console.log('\nIML viewer smoke test\n' + out.join('\n') + '\n');
await browser.close();
