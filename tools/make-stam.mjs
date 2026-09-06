// Builds assets/stam.svg by ACTUALLY RUNNING STAM and recording the frames.
//
// Implements the three rules from github.com/namashworks/stam-ml:
//   KAF  a_i <- a_i + eta * (rho_i / m_i) * (x - a_i)      heavy anchors resist
//   SET  H = -p log2 p - (1-p) log2 (1-p) over error SIGNS  split when H < 0.7
//   Gabriel graph: edge (i,j) iff no other anchor lies in the circle on diameter ij
//
// The data has a step discontinuity at u = 0.62. Anchors sitting on the step get
// systematically one-sided errors, entropy collapses, and SET splits them. Anchors
// in the noisy flat region get balanced errors, entropy stays high, and they hold.
// That contrast is the whole point of the rule, so the animation is built to show it.
//
// eta and the window are scaled up from the library defaults (0.01, 20) so the
// motion is visible in eighteen seconds. Everything else is the real rule.
//
//   node _tools/make-stam.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const FRAMES = 56, STEPS_PER_FRAME = 4, DUR = 18;
const K = 3, ETA = 0.30, MASS_GROWTH = 0.10, LR_THETA = 0.35;
const WINDOW = 12, FISSION_THRESHOLD = 0.7, MAX_ANCHORS = 9, EPS = 1e-8;

// deterministic PRNG so the panel is reproducible
let seed = 20260906;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// the manifold: an S curve, with a step in the target at u = 0.62
const manifold = (u) => 0.5 + 0.26 * Math.sin(u * Math.PI * 1.8);
const target = (u) => (u < 0.62 ? u * 0.8 : u * 0.8 + 0.34);
const sample = () => {
  const u = rnd();
  return { u, v: manifold(u) + (rnd() - 0.5) * 0.09, y: target(u) + (rnd() - 0.5) * 0.06 };
};

const l1 = (a, u, v) => Math.abs(a.u - u) + Math.abs(a.v - v);
const entropy = (signs) => {
  const p = signs.reduce((s, x) => s + x, 0) / signs.length;
  if (p <= 0 || p >= 1) return 0;
  return -(p * Math.log2(p)) - (1 - p) * Math.log2(1 - p);
};

// Gabriel graph: no other anchor inside the circle whose diameter is the edge
const gabriel = (A) => {
  const out = [];
  for (let i = 0; i < A.length; i++) {
    for (let j = i + 1; j < A.length; j++) {
      const mx = (A[i].u + A[j].u) / 2, my = (A[i].v + A[j].v) / 2;
      const r2 = ((A[i].u - A[j].u) ** 2 + (A[i].v - A[j].v) ** 2) / 4;
      let clear = true;
      for (let k = 0; k < A.length && clear; k++) {
        if (k === i || k === j) continue;
        if ((A[k].u - mx) ** 2 + (A[k].v - my) ** 2 < r2) clear = false;
      }
      if (clear) out.push([i, j]);
    }
  }
  return out;
};

// --- run it -------------------------------------------------------------
const anchors = [0.12, 0.3, 0.5, 0.72, 0.9].map((u, i) => ({
  id: i, u, v: manifold(u), theta: target(u), m: 1, signs: [], born: 0,
}));
let nextId = anchors.length;

const cloud = [];
for (let i = 0; i < 70; i++) cloud.push(sample());

const frames = [];
let seen = 0, lastSplitFrame = -99, focus = 0;

for (let f = 0; f < FRAMES; f++) {
  const events = [];
  for (let s = 0; s < STEPS_PER_FRAME; s++) {
    const x = sample();
    seen++;
    const d = anchors.map((a) => ({ a, w: 1 / (l1(a, x.u, x.v) + EPS) }));
    d.sort((p, q) => q.w - p.w);
    const near = d.slice(0, K);
    const sw = near.reduce((t, n) => t + n.w, 0);
    const rho = near.map((n) => n.w / sw);
    const pred = near.reduce((t, n, i) => t + rho[i] * n.a.theta, 0);
    const err = x.y - pred;

    near.forEach((n, i) => {
      const a = n.a, step = ETA * (rho[i] / a.m);
      a.u += step * (x.u - a.u);
      a.v += step * (x.v - a.v);
      a.theta += LR_THETA * rho[i] * err;
      a.m += MASS_GROWTH * rho[i];
    });

    const win = near[0].a;
    focus = win.id;
    win.signs.push(err >= 0 ? 1 : 0);
    if (win.signs.length > WINDOW) win.signs.shift();

    if (s === STEPS_PER_FRAME - 1) {
      events.push({ x, pulls: near.map((n) => ({ u: n.a.u, v: n.a.v })) });
    }

    // Structural Entropy Trigger
    if (win.signs.length >= WINDOW && anchors.length < MAX_ANCHORS && f - lastSplitFrame > 6) {
      const H = entropy(win.signs);
      if (H < FISSION_THRESHOLD) {
        const off = 0.035;
        anchors.push({ id: nextId++, u: win.u + off, v: win.v - off * 0.6,
                       theta: win.theta, m: win.m / 2, signs: [], born: f });
        win.m /= 2; win.signs = [];
        lastSplitFrame = f;
        events.push({ split: true });
      }
    }
  }

  const win = anchors.find((a) => a.id === focus) || anchors[0];
  frames.push({
    pos: anchors.map((a) => ({ id: a.id, u: a.u, v: a.v, m: a.m, born: a.born })),
    edges: gabriel(anchors).map(([i, j]) => [anchors[i].id, anchors[j].id]),
    signs: win.signs.slice(), H: win.signs.length ? entropy(win.signs) : 1,
    ready: win.signs.length >= WINDOW,
    count: anchors.length, seen, events,
  });
}

// --- draw it ------------------------------------------------------------
const X = (u) => Math.round(70 + u * 680);
const Y = (v) => Math.round(400 - v * 300);
// frames are evenly spaced, so keyTimes is redundant: SMIL distributes
// values evenly by default. Emitting it on ~200 elements cost 100 KB.
const anim = (attr, vals, extra = '') =>
  `<animate attributeName="${attr}" values="${vals.join(';')}" dur="${DUR}s" repeatCount="indefinite" calcMode="linear"${extra}/>`;
const step = (attr, vals) =>
  `<animate attributeName="${attr}" values="${vals.join(';')}" dur="${DUR}s" repeatCount="indefinite" calcMode="discrete"/>`;

const ids = [...new Set(frames.flatMap((f) => f.pos.map((p) => p.id)))];
const at = (f, id) => frames[f].pos.find((p) => p.id === id);
const held = (f, id) => at(f, id) || frames.map((fr) => fr.pos.find((p) => p.id === id)).find(Boolean);

let body = '';

// data cloud
body += '  <g fill="#2b3a52">\n' + cloud
  .map((c) => `    <circle cx="${X(c.u)}" cy="${Y(c.v)}" r="2"/>`).join('\n') + '\n  </g>\n';

// Gabriel edges, rewiring as anchors move
const pairs = [...new Set(frames.flatMap((f) => f.edges.map(([a, b]) => `${a}-${b}`)))];
body += '  <g stroke="url(#st-edge)" stroke-width="1.3" opacity="0.75" stroke-linecap="round">\n';
for (const key of pairs) {
  const [a, b] = key.split('-').map(Number);
  const on = frames.map((f) => (f.edges.some(([i, j]) => i === a && j === b) ? '0.75' : '0'));
  body += `    <line x1="0" y1="0" x2="0" y2="0" opacity="0">`
    + anim('x1', frames.map((_, f) => X(held(f, a).u)))
    + anim('y1', frames.map((_, f) => Y(held(f, a).v)))
    + anim('x2', frames.map((_, f) => X(held(f, b).u)))
    + anim('y2', frames.map((_, f) => Y(held(f, b).v)))
    + step('opacity', on) + '</line>\n';
}
body += '  </g>\n';

// samples arriving, with the pull lines to the k anchors they move
frames.forEach((f, i) => {
  const ev = f.events.find((e) => e.x);
  if (!ev || i % 2) return;
  const on = frames.map((_, j) => (j === i || j === i + 1 ? '1' : '0'));
  body += `  <g opacity="0">${step('opacity', on)}\n`;
  for (const p of ev.pulls) {
    body += `    <line x1="${X(ev.x.u)}" y1="${Y(ev.x.v)}" x2="${X(p.u)}" y2="${Y(p.v)}" stroke="#fbbf24" stroke-width="1" opacity="0.5"/>\n`;
  }
  body += `    <circle cx="${X(ev.x.u)}" cy="${Y(ev.x.v)}" r="9" fill="none" stroke="#fbbf24" stroke-width="1.4" opacity="0.7"/>\n`;
  body += `    <circle cx="${X(ev.x.u)}" cy="${Y(ev.x.v)}" r="3" fill="#fde68a"/>\n  </g>\n`;
});

// anchors: radius carries mass, so you watch them get heavy
for (const id of ids) {
  const alive = frames.map((_, f) => (at(f, id) ? '1' : '0'));
  const cx = frames.map((_, f) => X(held(f, id).u));
  const cy = frames.map((_, f) => Y(held(f, id).v));
  const r = frames.map((_, f) => (4.5 + Math.min(held(f, id).m, 6) * 0.9).toFixed(1));
  const col = id < 5 ? '#22d3ee' : '#a78bfa';
  body += `  <g opacity="0">${step('opacity', alive)}\n`
    + `    <circle r="0" fill="#0d1428" stroke="${col}" stroke-width="1.7">${anim('cx', cx)}${anim('cy', cy)}${anim('r', r)}</circle>\n`
    + `    <circle r="2.4" fill="${col}">${anim('cx', cx)}${anim('cy', cy)}</circle>\n  </g>\n`;
}

// --- the SET readout ----------------------------------------------------
const HX = 800;
let hud = '';
hud += `  <text x="${HX}" y="96" fill="#a78bfa" font-size="11" letter-spacing="2.6" font-family="'JetBrains Mono','SF Mono',Consolas,monospace">STRUCTURAL ENTROPY TRIGGER</text>\n`;
hud += `  <text x="${HX}" y="118" fill="#64748b" font-size="11" font-family="'Segoe UI',Arial,sans-serif">Sign of the last ${WINDOW} errors, not their size.</text>\n`;

for (let s = 0; s < WINDOW; s++) {
  const sx = HX + s * 24;
  const plus = frames.map((f) => (f.signs.length > s && f.signs[s] === 1 ? '1' : '0'));
  const minus = frames.map((f) => (f.signs.length > s && f.signs[s] === 0 ? '1' : '0'));
  hud += `    <rect x="${sx}" y="134" width="18" height="18" fill="#131c30" stroke="#1e2a40"/>\n`;
  hud += `    <text x="${sx + 9}" y="148" text-anchor="middle" font-size="13" fill="#4ade80" opacity="0" font-family="'JetBrains Mono',monospace">+${step('opacity', plus)}</text>\n`;
  hud += `    <text x="${sx + 9}" y="148" text-anchor="middle" font-size="13" fill="#f87171" opacity="0" font-family="'JetBrains Mono',monospace">−${step('opacity', minus)}</text>\n`;
}

const BW = 288;
hud += `  <text x="${HX}" y="188" fill="#64748b" font-size="10.5" letter-spacing="2" font-family="'JetBrains Mono',monospace">H = -p log2 p - (1-p) log2 (1-p)</text>\n`;
hud += `  <rect x="${HX}" y="200" width="${BW}" height="12" rx="6" fill="#131c30"/>\n`;
hud += `  <rect x="${HX}" y="200" width="0" height="12" rx="6" fill="#4ade80">`
  + anim('width', frames.map((f) => Math.round(f.H * BW)))
  + anim('fill', frames.map((f) => (f.H < FISSION_THRESHOLD ? '#f87171' : '#4ade80'))) + '</rect>\n';
const tx = HX + Math.round(FISSION_THRESHOLD * BW);
hud += `  <line x1="${tx}" y1="194" x2="${tx}" y2="218" stroke="#fbbf24" stroke-width="1.4"/>\n`;
hud += `  <text x="${tx + 6}" y="230" fill="#fbbf24" font-size="10" font-family="'JetBrains Mono',monospace">0.7 fission threshold</text>\n`;

const splitting = frames.map((f) => (f.ready && f.H < FISSION_THRESHOLD ? '1' : '0'));
const holding = frames.map((f) => (f.ready && f.H < FISSION_THRESHOLD ? '0' : '1'));
hud += `  <text x="${HX}" y="266" font-size="14" letter-spacing="2.4" fill="#4ade80" opacity="0" font-family="'JetBrains Mono',monospace">SIGNS BALANCED → NOISE → HOLD${step('opacity', holding)}</text>\n`;
hud += `  <text x="${HX}" y="266" font-size="14" letter-spacing="2.4" fill="#f87171" opacity="0" font-family="'JetBrains Mono',monospace">SIGNS ONE-SIDED → BIAS → SPLIT${step('opacity', splitting)}</text>\n`;

hud += `  <line x1="${HX}" y1="292" x2="${HX + BW}" y2="292" stroke="#1e2a40" stroke-width="1.2"/>\n`;
hud += `  <text x="${HX}" y="318" fill="#8ea9f2" font-size="11" letter-spacing="2.6" font-family="'JetBrains Mono',monospace">KINETIC ANCHOR FLOW</text>\n`;
hud += `  <text x="${HX}" y="342" fill="#c9d5e4" font-size="13" font-family="'JetBrains Mono',monospace">aᵢ ← aᵢ + η · (ρᵢ / mᵢ) · (x − aᵢ)</text>\n`;
hud += `  <text x="${HX}" y="362" fill="#64748b" font-size="11" font-family="'Segoe UI',Arial,sans-serif">Radius is mass. Heavy anchors stop moving.</text>\n`;

for (let n = 5; n <= MAX_ANCHORS; n++) {
  const on = frames.map((f) => (f.count === n ? '1' : '0'));
  hud += `  <text x="${HX}" y="392" fill="#22d3ee" font-size="12" letter-spacing="2" font-family="'JetBrains Mono',monospace">ANCHORS ${n} / ${MAX_ANCHORS}${step('opacity', on)}</text>\n`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480" width="1200" height="480" role="img"
     aria-label="STAM running. Samples arrive and pull the three nearest anchors, weighted by mass so heavy anchors resist. A window of error signs is shown; when their Shannon entropy falls below 0.7 the anchor splits, and the Gabriel graph rewires.">
  <defs>
    <linearGradient id="st-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#070c1a"/><stop offset="60%" stop-color="#0d1428"/><stop offset="100%" stop-color="#141d3a"/>
    </linearGradient>
    <linearGradient id="st-edge" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
    <pattern id="st-scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="#7fe7f7" opacity="0.05"/>
    </pattern>
    <radialGradient id="st-glow" cx="50%" cy="50%">
      <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.18"/><stop offset="100%" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="480" fill="url(#st-bg)"/>
  <circle cx="400" cy="250" r="330" fill="url(#st-glow)"/>
  <rect width="1200" height="480" fill="url(#st-scan)"/>
  <g stroke="#a78bfa" stroke-width="1.6" fill="none" opacity="0.45">
    <path d="M16,44 V16 H44"/><path d="M1156,16 H1184 V44"/>
    <path d="M1184,436 V464 H1156"/><path d="M44,464 H16 V436"/>
    <animate attributeName="opacity" values="0.45;0.82;0.45" dur="5.2s" repeatCount="indefinite"/>
  </g>
  <text x="56" y="44" fill="#a78bfa" opacity="0.9" font-size="11" letter-spacing="3.2"
        font-family="'JetBrains Mono','SF Mono',Consolas,monospace">STAM · LEARNING ONLINE, ONE SAMPLE AT A TIME</text>
  <line x1="778" y1="70" x2="778" y2="410" stroke="#1e2a40" stroke-width="1.2"/>

${body}${hud}
  <text x="56" y="452" fill="#475569" font-size="10.5" letter-spacing="1.6"
        font-family="'JetBrains Mono','SF Mono',Consolas,monospace">THE TARGET STEPS AT u=0.62 · ANCHORS ON THE STEP GET ONE-SIDED ERRORS AND SPLIT · ANCHORS IN NOISE STAY PUT · REAL RULES, SYNTHETIC DATA</text>
</svg>
`;

const out = join(root, 'assets', 'stam.svg');
writeFileSync(out, svg, 'utf8');
const splits = frames.filter((f) => f.events.some((e) => e.split)).length;
console.log(`built stam.svg  ${svg.length.toLocaleString()} bytes`);
console.log(`  ${FRAMES} frames, ${frames[FRAMES - 1].seen} samples seen`);
console.log(`  anchors ${frames[0].count} -> ${frames[FRAMES - 1].count} via ${splits} entropy-triggered splits`);
console.log(`  gabriel pairs ever connected: ${pairs.length}`);
console.log(`  entropy range ${Math.min(...frames.map((f) => f.H)).toFixed(2)} to ${Math.max(...frames.map((f) => f.H)).toFixed(2)}`);
