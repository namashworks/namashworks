// Checks the PUBLISHED profile, not the working copy: fetches the live README
// from GitHub, pulls out every asset and internal link it references, and
// requests each one. Catches the case where a page renders perfectly on disk
// and shows broken images to everyone else.
//
// This file ships as a byte-identical copy at tools/check-live.mjs, so anyone can
// run the same check against the published page. Either path works:
//   node _tools/check-live.mjs   from the working folder
//   node tools/check-live.mjs    from a clean clone
const USER = 'namashworks';
const RAW = `https://raw.githubusercontent.com/${USER}/${USER}/main`;

let pass = 0, fail = 0;
const ok = (m) => { console.log('  PASS  ' + m); pass++; };
const bad = (m) => { console.log('  FAIL  ' + m); fail++; };

const readme = await fetch(`${RAW}/README.md`);
if (!readme.ok) {
  console.error(`Could not fetch the live README (HTTP ${readme.status}). Has it been pushed?`);
  process.exitCode = 2;
} else {
  const text = await readme.text();
  ok(`live README fetched, ${text.length.toLocaleString()} bytes`);

  const assets = [...new Set([...text.matchAll(/(?:src|srcset)="(assets\/[^"]+)"/g)].map((m) => m[1]))];
  // both markdown links and raw <a href>, or the ones in HTML captions go unchecked
  const links = [...new Set([
    ...[...text.matchAll(/\]\((examples\/[^)]+|tools\/[^)]+)\)/g)].map((m) => m[1]),
    ...[...text.matchAll(/href="(examples\/[^"]+|tools\/[^"]+)"/g)].map((m) => m[1]),
  ])];

  for (const path of [...assets, ...links]) {
    const res = await fetch(`${RAW}/${path}`, { method: 'HEAD' });
    const size = res.headers.get('content-length');
    if (res.ok) ok(`${path} → ${res.status}${size ? `, ${Number(size).toLocaleString()} bytes` : ''}`);
    else bad(`${path} → ${res.status}, this is a broken image on the live profile`);
  }

  // things that must be true of the published text itself
  const checks = [
    [!/Ã|â‚¬|Â·/.test(text), 'no double-encoded UTF-8 survived the push'],
    [text.includes('現地現物') && text.includes('빨리빨리') && text.includes('הגנה לעומק'),
      'the non-ASCII content survived the push intact'],
    [!text.includes(':jp:'), 'no emoji flag shortcodes on the live page'],
    [!/img\.shields\.io|github-readme-stats/.test(text), 'the live page still makes no third party requests'],
    [text.includes("Ce que l'on conçoit bien"), 'Boileau is quoted correctly on the live page'],
  ];
  for (const [cond, msg] of checks) (cond ? ok : bad)(msg);
}

console.log(`\nLIVE RESULT: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
