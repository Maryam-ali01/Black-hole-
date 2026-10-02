const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let W, H, S, dpr;
function resize() {
  dpr = window.devicePixelRatio || 1;
  W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
  S = Math.min(W, H) * 0.46;
}
addEventListener('resize', resize); resize();

// colour ramp: white -> yellow -> orange -> purple -> blue (inner to outer)
const stops = [[0,[255,255,255]],[0.08,[255,245,200]],[0.2,[255,205,60]],[0.38,[240,120,40]],[0.58,[150,70,150]],[0.8,[100,100,220]],[1,[70,80,200]]];
function ramp(t) {
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [t0,a] = stops[i-1], [t1,b] = stops[i], k = (t - t0) / (t1 - t0);
    return a.map((v, j) => Math.round(v + (b[j] - v) * k));
  }
  return stops[stops.length-1][1];
}

const N = 8000, P = [];
const R0 = 0.09;
for (let i = 0; i < N; i++) {
  const t = Math.pow(Math.random(), 0.75), r = R0 + t * (1 - R0);
  const c = ramp(t).map(v => Math.min(255, Math.round(v * 1.2 + 20)));
  P.push({
    r, a: Math.random() * Math.PI * 2,
    h: (Math.random() - 0.5) * 0.02 * (0.3 + r),
    w: 0.04 * Math.pow(r / R0, -1.5) + 0.003,
    col: c, al: 0.55 + Math.random() * 0.35, lw: 1 + Math.random() * 1.6
  });
}

// twinkling background stars (fixed in space, so they move when you rotate)
const stars = [];
for (let i = 0; i < 450; i++) {
  const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u);
  stars.push({ x: q * Math.cos(t), y: u, z: q * Math.sin(t), s: Math.random() * 1.4 + 0.3, ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 2 });
}
// faint polar jets shooting out of the poles
const jets = [];
for (let i = 0; i < 500; i++) jets.push({ t: Math.random(), a: Math.random() * 6.28, sg: i % 2 ? 1 : -1, v: 0.004 + Math.random() * 0.006 });

let yaw = 0.3, pitch = 1.2, zoom = 1, drag = false, lx = 0, ly = 0, auto = true;
cv.addEventListener('pointerdown', e => { drag = true; auto = false; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); cv.classList.add('drag'); });
cv.addEventListener('pointerup', () => { drag = false; cv.classList.remove('drag'); });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  yaw += (e.clientX - lx) * 0.008;
  pitch += (e.clientY - ly) * 0.008;   // no clamp: full 360° in every direction
  lx = e.clientX; ly = e.clientY;
});
cv.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.min(3, Math.max(0.4, zoom * (e.deltaY > 0 ? 0.93 : 1.07))); }, { passive: false });

function project(r, a, h, cy, sy, cp, sp) {
  const x = r * Math.cos(a), z = r * Math.sin(a);
  const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
  const y2 = h * cp - z1 * sp, z2 = h * sp + z1 * cp;
  const f = 1 / (1 - z2 * 0.35);
  return [W / 2 + x1 * S * zoom * f, H / 2 + y2 * S * zoom * f, z2];
}

function drawHole() {
  const R = R0 * 0.85 * S * zoom, cx = W / 2, cy = H / 2;
  const g = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 2.6);
  g.addColorStop(0, 'rgba(255,240,200,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 2.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2 * dpr;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, 7); ctx.stroke();
}

function pass(front, cy, sy, cp, sp) {
  for (const p of P) {
    const [x0, y0, z0] = project(p.r, p.a, p.h, cy, sy, cp, sp);
    if ((z0 >= 0) !== front) continue;
    const [x1, y1] = project(p.r, p.a - p.w * 4, p.h, cy, sy, cp, sp);
    ctx.strokeStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${p.al})`;
    ctx.lineWidth = p.lw * dpr;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
}

function drawStars(cy, sy, cp, sp, now) {
  for (const p of stars) {
    const x1 = p.x * cy - p.z * sy, z1 = p.x * sy + p.z * cy;
    const y2 = p.y * cp - z1 * sp;
    const X = W / 2 + x1 * S * 2.2, Y = H / 2 + y2 * S * 2.2;
    if (X < 0 || X > W || Y < 0 || Y > H) continue;
    const a = 0.35 + 0.35 * Math.sin(now * 0.001 * p.sp + p.ph);
    ctx.fillStyle = `rgba(200,210,255,${a})`;
    ctx.fillRect(X, Y, p.s * dpr, p.s * dpr);
  }
}
function jetPass(front, cy, sy, cp, sp) {
  for (const j of jets) {
    const h = j.sg * (0.1 + j.t * 1.1), r = 0.008 + j.t * 0.07;
    const [x, y, z] = project(r, j.a, h, cy, sy, cp, sp);
    if ((z >= 0) !== front) continue;
    ctx.fillStyle = `rgba(150,180,255,${0.55 * (1 - j.t)})`;
    ctx.fillRect(x, y, 1.6 * dpr, 1.6 * dpr);
  }
}
function frame(now) {
  if (auto) yaw += 0.007;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  for (const p of P) p.a += p.w;
  for (const j of jets) { j.t += j.v; if (j.t > 1) j.t = 0; }
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  ctx.lineCap = 'round';
  drawStars(cy, sy, cp, sp, now || 0);
  ctx.globalCompositeOperation = 'lighter';
  jetPass(false, cy, sy, cp, sp);
  pass(false, cy, sy, cp, sp);            // particles behind the hole
  ctx.globalCompositeOperation = 'source-over';
  drawHole();                              // hole hides what is behind it
  ctx.globalCompositeOperation = 'lighter';
  pass(true, cy, sy, cp, sp);
  jetPass(true, cy, sy, cp, sp);             // particles in front
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
