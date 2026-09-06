// Builds assets/city-defended.svg: the anime city artwork with monitor drones
// patrolling the sky and three threats being intercepted on the outer dome.
//
// The JPEG has to be embedded, because an SVG loaded through an <img> tag cannot
// reach out for a second file. That is also why there is no static twin of this
// one: the reduced-motion fallback is plain city.jpg, which is the same painting
// without the overlay, and costs nothing extra.
//
//   node _tools/make-hero.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const W = 1536, H = 1024;

// The outer teal dome in the painting, fitted as a circle so the interception
// flares sit on it instead of floating near it.
const CX = 750, CY = 1356, R = 1037;
const onDome = (deg) => {
  const t = (deg * Math.PI) / 180;
  return [ (CX + R * Math.sin(t)).toFixed(1), (CY - R * Math.cos(t)).toFixed(1) ];
};
const flare = (a, b) => {
  const [x1, y1] = onDome(a), [x2, y2] = onDome(b);
  return `M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`;
};

const drone = (scale, light, rotorOffset) => `
      <g transform="scale(${scale})">
        <polygon points="0,11 -15,46 15,46" fill="url(#hero-cone)"/>
        <line x1="-22" y1="0" x2="22" y2="0" stroke="#dbeeff" stroke-width="2.6" stroke-linecap="round"/>
        <ellipse cx="0" cy="2" rx="9" ry="5.4" fill="#e8f4ff"/>
        <ellipse cx="0" cy="2" rx="9" ry="5.4" fill="none" stroke="#7fd8ff" stroke-width="0.9"/>
        <ellipse cx="-22" cy="-3.5" rx="12" ry="3" fill="none" stroke="#dbeeff" stroke-width="1.6">
          <animate attributeName="rx" values="12;4;12" dur="0.22s" repeatCount="indefinite"/></ellipse>
        <ellipse cx="22" cy="-3.5" rx="12" ry="3" fill="none" stroke="#dbeeff" stroke-width="1.6">
          <animate attributeName="rx" values="12;4;12" dur="0.22s" begin="${rotorOffset}s" repeatCount="indefinite"/></ellipse>
        <circle cx="-22" cy="-3.5" r="2.6" fill="#ff5f6d"/>
        <circle cx="22" cy="-3.5" r="2.6" fill="#5dffa0"/>
        <circle cx="0" cy="9" r="2.8" fill="${light}">
          <animate attributeName="opacity" values="1;0.15;1" dur="1.5s" repeatCount="indefinite"/></circle>
      </g>`;

const patrol = (path, dur, scale, light, rotorOffset) => `
    <g>
      <animateMotion dur="${dur}s" repeatCount="indefinite" rotate="auto" calcMode="linear" path="${path}"/>${drone(scale, light, rotorOffset)}
    </g>`;

// t0 = when the threat starts falling, t1 = when it hits, as fractions of a 9s cycle
const threat = (path, t0, t1) => `
    <g opacity="0">
      <animateMotion dur="9s" repeatCount="indefinite" calcMode="linear"
                     keyPoints="0;0;1;1" keyTimes="0;${t0};${t1};1" path="${path}"/>
      <animate attributeName="opacity" values="0;0;1;1;0;0"
               keyTimes="0;${t0};${(t0 + 0.014).toFixed(3)};${(t1 - 0.005).toFixed(3)};${(t1 + 0.001).toFixed(3)};1"
               dur="9s" repeatCount="indefinite"/>
      <line x1="-16" y1="-62" x2="0" y2="0" stroke="#ff5c7a" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
      <circle r="6" fill="#ffe0e6"/>
      <circle r="15" fill="#ff5c7a" opacity="0.45" filter="url(#hero-soft)"/>
    </g>`;

const intercept = (pt, arc, t) => {
  const [x, y] = pt;
  const a = t.toFixed(3), b = (t + 0.008).toFixed(3), c = (t + 0.075).toFixed(3);
  return `
    <path d="${arc}" fill="none" stroke="#c9fff8" stroke-width="6" stroke-linecap="round" opacity="0" filter="url(#hero-soft)">
      <animate attributeName="opacity" values="0;0;0.95;0;0" keyTimes="0;${a};${b};${c};1" dur="9s" repeatCount="indefinite"/>
    </path>
    <circle cx="${x}" cy="${y}" r="0" fill="none" stroke="#4fd6c8" stroke-width="4">
      <animate attributeName="r" values="0;0;78;78" keyTimes="0;${a};${c};1" dur="9s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0;1;0;0" keyTimes="0;${a};${b};${c};1" dur="9s" repeatCount="indefinite"/>
    </circle>
    <circle cx="${x}" cy="${y}" r="34" fill="#c9fff8" opacity="0" filter="url(#hero-soft)">
      <animate attributeName="opacity" values="0;0;0.85;0;0" keyTimes="0;${a};${b};${(t + 0.045).toFixed(3)};1" dur="9s" repeatCount="indefinite"/>
    </circle>`;
};

const P1 = onDome(-35), P2 = onDome(-12), P3 = onDome(20);
const b64 = readFileSync(join(root, 'assets', 'city.jpg')).toString('base64');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
     aria-label="An anime night city under three shield domes. Monitor drones patrol the sky and three incoming threats are intercepted on the outer shield.">
  <defs>
    <linearGradient id="hero-cone" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7fd8ff" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#7fd8ff" stop-opacity="0"/>
    </linearGradient>
    <filter id="hero-soft" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>

  <!-- href only. Embedding the same base64 twice for an xlink fallback would
       double the file for browsers that have supported SVG2 href since 2017. -->
  <image href="data:image/jpeg;base64,${b64}" x="0" y="0" width="${W}" height="${H}"/>

  <!-- incoming, and stopped on the outer shield -->
  ${intercept(P1, flare(-43, -27), 0.28)}
  ${intercept(P2, flare(-20, -4), 0.52)}
  ${intercept(P3, flare(12, 28), 0.76)}
  ${threat(`M40,-80 L${P1[0]},${P1[1]}`, 0.16, 0.28)}
  ${threat(`M420,-80 L${P2[0]},${P2[1]}`, 0.40, 0.52)}
  ${threat(`M1230,-80 L${P3[0]},${P3[1]}`, 0.64, 0.76)}

  <!-- monitor drones on patrol -->
  ${patrol('M-80,340 Q560,250 1620,320', 24, 1.0, '#4fd6c8', 0.11)}
  ${patrol('M1620,460 Q980,395 -80,450', 20, 0.85, '#4a86f7', 0.07)}
  ${patrol('M-80,552 Q760,498 1620,545', 30, 0.7, '#ff7a5c', 0.13)}
  ${patrol('M1620,212 Q950,158 -80,228', 26, 0.62, '#4fd6c8', 0.05)}
</svg>
`;

const out = join(root, 'assets', 'city-defended.svg');
writeFileSync(out, svg, 'utf8');
console.log(`built city-defended.svg  ${svg.length.toLocaleString()} bytes`
  + `  (city.jpg ${readFileSync(join(root, 'assets', 'city.jpg')).length.toLocaleString()} bytes embedded)`);
console.log(`  interception points: ${P1.join(',')}  ${P2.join(',')}  ${P3.join(',')}`);
