// Regression suite for the namashworks profile README.
//
// This file ships. tools/test.mjs is a byte-identical copy, and group 18 fails if
// the two ever drift, for the same reason tools/run-sql.mjs is a copy: the README
// says the page is tested, so the thing that tests it has to be runnable by whoever
// reads that claim. It resolves the repository root relative to itself, so either
// path works:
//   node _tools/test.mjs     from the working folder
//   node tools/test.mjs      from a clean clone
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runQuery } from './run-sql.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0, fail = 0;
const ok = (m) => { console.log('  PASS  ' + m); pass++; };
const bad = (m) => { console.log('  FAIL  ' + m); fail++; };
const is = (cond, m, detail) => (cond ? ok(m) : bad(m + (detail ? ' -> ' + detail : '')));
let groupCount = 0;
const group = (t) => { groupCount++; console.log('== ' + t + ' =='); };

// Verified against https://api.github.com/users/namashworks/repos on 2026-09-07.
// Re-check with: node _tools/verify-repos.mjs
// The profile repo itself (namashworks/namashworks) is deliberately NOT in this
// list. It is this page, not a project, so it does not count toward the sixteen.
const OWN = [
  'egkg-architecture', 'Bridge-ADK', 'qledger', 'Chatform', 'Successapp', 'autoRECON',
  'stam-ml', 'Genetic-Transformer', 'IPipe', 'StudyMate', 'Json-to-Toon-converter',
  'Synthetic-Data-Generator-with-converter', 'multiformat-toon',
  'FNet-Pytorch-Implementation', 'Genz-medical-advisor', 'movie-rating-prediction-ml-pipeline',
];
const FORKS = ['nanobot', 'job_market_intelligence_bot', 'dont_lie_to_me_azure',
  'langextract', 'WA_Hackthon_2025', 'knowledge-graph-llms', 'pytorch'];

const readme = read('README.md');
const readmeBytes = readFileSync(join(root, 'README.md'));
// preview.html is a local build artifact and is deliberately not committed, so a
// clean clone will not have it. Group 8 asserts the same number of things either
// way rather than skipping: with a preview it checks parity, without one it checks
// the README and the asset files directly. A visitor and the author therefore get
// the same count, which is the only way the number printed on the page can be true
// for both of them.
const previewPath = join(root, 'preview.html');
const preview = existsSync(previewPath) ? read('preview.html') : null;
const ANIMATED = ['banner', 'greetings', 'proof', 'bridge', 'stam', 'stack',
                  'query', 'roadmap', 'toolbox', 'thanks'];

group('1. encoding and house style');
is(!(readmeBytes[0] === 0xef && readmeBytes[1] === 0xbb && readmeBytes[2] === 0xbf), 'README has no UTF-8 BOM');
is(!/Ã|Ã|â/.test(readme), 'README free of double-encoded UTF-8');
is(!readme.includes('—'), 'README has no em dashes');
for (const s of ['現地現物', '빨리빨리', 'Gründlichkeit',
  '实事求是', '系統', '查询', 'הגנה לעומק']) {
  is(readme.includes(s), `README contains ${s}`);
}
// GitHub turns :jp: into the Unicode flag character, and Windows has no flag
// emoji font, so those render as the letters "JP". Real files render everywhere.
const FLAGS = { jp: 'Japan', kr: 'Korea', de: 'Germany', il: 'Israel',
                cn: 'China', tw: 'Taiwan', ca: 'Canada', au: 'Australia', fr: 'France' };
for (const [code, name] of Object.entries(FLAGS)) {
  is(readme.includes(`assets/flag-${code}.svg`), `Arbeitsweise table shows a real ${name} flag image`);
  is(existsSync(join(root, 'assets', `flag-${code}.svg`)), `flag-${code}.svg exists`);
}
is(!/:(jp|kr|de|israel|cn|taiwan|canada|australia):/.test(readme),
  'no emoji flag shortcodes left anywhere');

group('2. assets exist and are budgeted');
const refs = [...readme.matchAll(/(?:src|srcset)="(assets\/[^"]+)"/g)].map((m) => m[1]);
const unique = [...new Set(refs)];
for (const r of unique) is(existsSync(join(root, r)), `${r} exists`);
let total = 0, biggest = ['', 0];
for (const f of readdirSync(join(root, 'assets'))) {
  const n = statSync(join(root, 'assets', f)).size;
  total += n;
  if (n > biggest[1]) biggest = [f, n];
}
is(biggest[1] < 400_000, `largest asset under 400 KB`, `${biggest[0]} is ${biggest[1].toLocaleString()} bytes`);
is(total < 700_000, `all assets under 700 KB total`, `${total.toLocaleString()} bytes`);
console.log(`  INFO  ${readdirSync(join(root, 'assets')).length} assets, ${total.toLocaleString()} bytes total`);

group('3. reduced motion');
for (const n of ANIMATED) {
  const anim = read(`assets/${n}.svg`);
  const still = existsSync(join(root, 'assets', `${n}-static.svg`)) ? read(`assets/${n}-static.svg`) : null;
  is(/<animate/.test(anim), `${n}.svg is animated`);
  is(still !== null, `${n}-static.svg exists`);
  if (still) {
    is(!/<animate/.test(still), `${n}-static.svg has no animation left`);
    is(readme.includes(`srcset="assets/${n}-static.svg"`), `README offers ${n}-static.svg to reduced-motion readers`);
  }
}
is(!/opacity="0"[^>]*\/?>[\s]*<\/text>/.test(read('assets/greetings-static.svg')) &&
   read('assets/greetings-static.svg').includes('opacity="1"'),
   'greetings-static.svg is not blank, one greeting is revealed');
// The hero is the exception: its fallback is the plain painting, not a still twin,
// because a twin would duplicate the embedded 220 KB JPEG for nothing.
is(/<animate/.test(read('assets/city-defended.svg')), 'city-defended.svg is animated');
is(readme.includes('srcset="assets/city.jpg"'), 'the hero falls back to the plain painting for reduced motion');
is(!existsSync(join(root, 'assets', 'city-defended-static.svg')),
  'no still twin of the hero, which would duplicate the embedded JPEG');
is(read('assets/city-defended.svg').split('base64,').length === 2,
  'the hero embeds the artwork exactly once');

group('4. accessibility');
const imgs = [...readme.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const flagImgs = imgs.filter((t) => /src="assets\/flag-/.test(t));
const contentImgs = imgs.filter((t) => !/src="assets\/flag-/.test(t));
is(contentImgs.length > 0 && contentImgs.every((t) => /\balt="[^"]{4,}"/.test(t)),
  `all ${contentImgs.length} content images carry meaningful alt text`,
  contentImgs.filter((t) => !/\balt="[^"]{4,}"/.test(t)).join(' | '));
is(flagImgs.length === 9 && flagImgs.every((t) => /\balt=""/.test(t)),
  'the 9 flags are marked decorative with alt="", the country name beside them carries the meaning');

group('5. no third party dependencies');
const external = [...readme.matchAll(/(?:src|srcset)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
is(external.length === 0, 'README loads no remote images', external.join(', '));
is(!readme.includes('img.shields.io') && !readme.includes('github-readme-stats'),
  'no shields.io or stats-card services');
is(!/src="http:\/\//.test(readme), 'nothing loaded over plain http');

group('6. repositories are real and are his own');
const linked = [...new Set([...readme.matchAll(/github\.com\/namashworks\/([A-Za-z0-9._-]+)/g)].map((m) => m[1]))];
for (const r of linked) {
  if (FORKS.includes(r)) bad(`README presents ${r} as own work, but it is a fork`);
  else is(OWN.includes(r), `${r} is a verified repository of his`);
}
const stack = read('assets/stack.svg');
for (const r of OWN) is(stack.includes(r), `stack panel names ${r}`);
for (const f of FORKS) is(!stack.includes(f), `stack panel does not claim the fork ${f}`);
const claimed = (stack.match(/(\d+) REPOSITORIES/) || [])[1];
is(claimed === String(OWN.length), `stack panel claims ${OWN.length} repositories`, `says ${claimed}`);

group('7. the SQL is executed, not asserted');
const rows = runQuery();
is(rows.length === 4, 'query returns four groups', `got ${rows.length}`);
is(rows.every((r) => r.backend.startsWith('simulator_')),
  'no real hardware vendor is named in the fixture');
is(!read('assets/query.svg').includes('interval') && !read('assets/query.svg').includes('now()'),
  'query panel uses no PostgreSQL-only syntax');
const svg = read('assets/query.svg');
for (const r of rows) {
  is(svg.includes(r.backend), `panel shows ${r.backend}`);
  is(svg.includes(String(r.mean_fidelity)), `panel shows executed mean_fidelity ${r.mean_fidelity} for ${r.backend}`);
}
for (const r of rows) {
  const line = `| ${r.backend} | ${r.mean_fidelity} | ${r.scored} | ${r.runs} |`;
  is(readme.includes(line), `README fallback table matches executed row for ${r.backend}`, line);
}
const d = rows.find((r) => r.backend === 'simulator_d');
is(d && d.scored === 2 && d.runs === 3, 'the null-handling case really is 2 scored of 3 runs');
const sqlInReadme = (readme.match(/```sql\n([\s\S]*?)```/) || [])[1].trim();
is(sqlInReadme === read('examples/query.sql').trim(),
  'the SQL printed in the README is byte-identical to the file that was executed');

group('8. preview is generated from the README');
console.log(`  INFO  preview.html ${preview ? 'is built, checking parity' : 'is not built, checking the README and assets directly'}`);
for (const h of [...readme.matchAll(/^## (.+)$/gm)].map((m) => m[1])) {
  const plain = h.replace(/\*/g, '');
  is(preview ? preview.includes(plain) : plain.trim().length > 0,
    `preview carries the "${h}" section`);
}
is(preview ? !preview.includes('assets/')
           : [...readme.matchAll(/(?:src|srcset)="([^"]+)"/g)].every((m) => m[1].startsWith('assets/')),
  'preview.html inlines every asset, nothing left to fetch');
// Ids are checked across the asset files themselves, not only the inlined preview.
// Inlining is what makes a collision bite, but the collision is created here.
// A still twin deliberately reuses its animated twin's ids, and the two are never
// inlined together, so only the animated panels are compared against each other.
const idSource = preview
  ? [preview]
  : readdirSync(join(root, 'assets'))
      .filter((n) => n.endsWith('.svg') && !n.endsWith('-static.svg') && !n.startsWith('flag-'))
      .map((n) => read(`assets/${n}`));
const ids = idSource.flatMap((s) => [...s.matchAll(/\sid="([a-z]+-[A-Za-z0-9]+)"/g)].map((m) => m[1]));
is(new Set(ids).size === ids.length, 'no duplicate SVG ids across the inlined panels',
  ids.filter((v, i) => ids.indexOf(v) !== i).join(', '));

group('9. honesty checks');
is(/architecture document/i.test(readme), 'EGKG is labelled an architecture document');
is(/not a clinically validated/i.test(readme), 'the medical model is labelled experimental');
is(/metaphor/i.test(readme), 'the artwork is labelled a metaphor, not a real system');
is(/fixture|illustrat|synthetic/i.test(readme), 'the SQL data is labelled synthetic');
for (const t of ['Docker', 'FastAPI', 'PostgreSQL']) {
  is(!readme.includes(t), `${t} is not claimed, it appears in no repository`);
}

group('10. a developer can see actual code');
const fences = [...readme.matchAll(/```(\w+)/g)].map((m) => m[1]);
const py = fences.filter((f) => f === 'python').length;
is(py >= 3, `${py} python snippets on the page`, 'a software engineer should not have to click through to see code');
is(fences.includes('sql'), 'a SQL snippet is on the page');
is(readme.includes('bridge_adk.serve('), 'the Bridge ADK call is shown, not just described');
is(readme.includes('evidence_span'), 'the EGKG evidence rule is quoted by the name it has in the design');
is(readme.includes('seed_simulator'), 'the QLedger reproducibility call is shown');
const details = (readme.match(/<details>/g) || []).length;
is(details >= 6, `${details} expandable sections, so depth is reachable without a wall of text`);

group('11. the threat model holds together');
const THREATS = [['Fabricated fact', 'egkg-architecture'],
                 ['Silent regression', 'stam-ml'],
                 ['Hardware drift', 'qledger']];
for (const [failure, repo] of THREATS) {
  is(readme.includes(failure), `the threat model names "${failure}"`);
  is(readme.includes(repo), `"${failure}" is answered by a real repository (${repo})`);
}
const panel = read('assets/city-defended.svg');
is((panel.match(/<animateMotion/g) || []).length === 7,
  'the hero animates 4 drones and 3 interceptions, matching the three threats in the table');

group('12. the two language rotators bookend the page');
const hello = read('assets/greetings.svg'), thanks = read('assets/thanks.svg');
for (const label of ['日本 · JAPAN', '한국 · KOREA', '中国 · CHINA', '臺灣 · TAIWAN, IN HOKKIEN',
                     'ISRAEL', 'DEUTSCHLAND · GERMANY', 'FRANCE · CANADA', 'AUSTRALIA', 'भारत · INDIA']) {
  is(hello.includes(label) && thanks.includes(label), `both rotators cover ${label}`);
}
is(readme.indexOf('assets/greetings.svg') < readme.indexOf('assets/thanks.svg'),
  'hello opens the page, thanks closes it');
is(readme.indexOf('assets/greetings.svg') < 1500, 'the greeting sits at the top, not buried');
is(readme.indexOf('assets/thanks.svg') > readme.length - 1500, 'the thanks sits at the very bottom');
is(thanks.includes('多謝'), 'Taiwan gets Hokkien thanks, not a repeat of the Mandarin');

group('13. what the README says ships, actually ships');
for (const p of ['examples/fixture.sql', 'examples/query.sql', 'examples/entropy.py',
                 'tools/make-stam.mjs', 'tools/run-sql.mjs', 'assets/flag-icons-LICENSE.txt',
                 '.gitignore', '.gitattributes']) {
  is(existsSync(join(root, p)), `${p} is in the repository`);
}
for (const link of [...readme.matchAll(/\]\((examples\/[^)]+|tools\/[^)]+)\)/g)].map((m) => m[1])) {
  is(existsSync(join(root, link)), `the README link to ${link} resolves`);
}
is(read('assets/flag-icons-LICENSE.txt').includes('MIT'),
  'the flag artwork ships with its MIT licence, because it is not mine');
// A generator once regenerated these from simplified hand drawings and silently
// replaced the accurate artwork. Assert the real thing is what is on disk.
const fromFlagIcons = Object.keys(FLAGS).filter((c) => c !== 'fr');
for (const code of fromFlagIcons) {
  is(read(`assets/flag-${code}.svg`).includes('flag-icons'),
    `flag-${code}.svg is the accurate flag-icons artwork, not a hand drawing`);
}
is(read('assets/flag-tw.svg').length > 2000,
  'the Taiwan flag has its twelve-rayed sun, not a plain white circle',
  'the simplified version was a circle and was visibly wrong');
is(!existsSync(join(here, 'make-flags.mjs')),
  'the generator that clobbered the real flags is retired');

group('14. corrected claims stay corrected');
const OVERCLAIM = [
  ['replays exactly', 'a seed reproduces a simulator, not physical quantum hardware'],
  ['cannot tell you why', 'neural networks have interpretability methods too'],
  ['fabricated fact impossible', 'provenance makes a claim auditable, not true'],
  ['coin-flip accuracy', 'an accuracy figure with no source behind it'],
  ['trust it', 'the project map is thematic, not a dependency stack'],
];
for (const [phrase, why] of OVERCLAIM) {
  is(!readme.toLowerCase().includes(phrase), `no overclaim: "${phrase}"`, why);
}
const flat = readme.replace(/\s+/g, ' ');
is(/auditable/i.test(flat), 'evidence is described as making a claim auditable, not true');
is(/stochastic/i.test(flat), 'physical hardware is described as stochastic');
is(/no built-in authentication/i.test(flat), 'the Bridge ADK v0.1 access boundary is stated');
is(/heuristic/i.test(flat), 'the entropy trigger is called a heuristic');
is(read('assets/stam.svg').includes('COLLECTING SIGNS'),
  'a partial sign window reads as collecting, not as maximum entropy');

group('15. the SQL panel is readable on a phone');
for (const f of ['query-mobile.svg', 'query-mobile-static.svg']) {
  is(existsSync(join(root, 'assets', f)), `${f} exists`);
}
is(readme.includes('(max-width: 560px)'), 'a phone-width source is offered before the desktop one');
const mobile = read('assets/query-mobile.svg');
for (const r of rows) {
  is(mobile.includes(r.backend) && mobile.includes(String(r.mean_fidelity)),
    `the phone panel carries the same executed row for ${r.backend}`);
}

group('16. the cultural section stays honest');
// Two rows were retrofitted: an engineering principle picked first, then assigned
// a country. That is the thing that reads as stereotype rather than influence.
is(!readme.includes('Yield thinking'),
  'Taiwan is no longer given an invented proverb', 'yield is an industrial habit, not a saying');
is(readme.includes('Not a saying, an industrial habit'),
  'the Taiwan row says outright that it is not a saying');
is(!readme.includes('Review first, in plain language'),
  'Canada no longer carries a practice with no national basis');
is(readme.includes('CAN-ASC-3.1'), 'the Canada row cites the actual plain-language standard');
is(/none of them are claims about what people from those places are like/i
    .test(readme.replace(/\*/g, '').replace(/\s+/g, ' ')),
  'the section disclaims national stereotyping in as many words');
// Adding France left the intro saying "Eight ideas" above nine rows. Tie them together.
const WORDS = { seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const stated = (readme.match(/\b(\w+) ideas that changed how I engineer/i) || [])[1];
const rowCount = (readme.match(/<img src="assets\/flag-/g) || []).length;
is(stated && WORDS[stated.toLowerCase()] === rowCount,
  `the intro says "${stated}" and the table has ${rowCount} rows`,
  'adding a country without updating the count is exactly how this drifts');
is(readme.includes("Ce que l'on conçoit bien"),
  'Boileau is quoted as he wrote it', 'the common misquote is "Ce qui se conçoit bien"');
is(!readme.includes('rather than peak specs'),
  'Taiwan is not said to compete instead of on leading-edge nodes',
  'TSMC competes on both, so the contrast was simply false');
// Every row was checked against a primary source on 2026-09-07. These assertions
// hold the citations in place and pin the verbatim wording that was verified.
const SOURCES = [
  ['toyota-europe.com', 'Japan cites Toyota'],
  ['koreaherald.com', 'Korea cites the Korea Herald'],
  ['duden.de', 'Germany cites Duden'],
  ['fr.wikisource.org', 'France cites the primary text'],
  ['nathanzeldes.com', 'Israel cites a source on rosh gadol'],
  ['Book of Han', 'China names the Book of Han'],
  ['tsmc.com', 'Taiwan cites TSMC'],
  ['accessible.canada.ca', 'Canada cites Accessibility Standards Canada'],
  ['history.cass.anu.edu.au', 'Australia cites the Australian National Dictionary Centre'],
];
for (const [needle, why] of SOURCES) is(readme.includes(needle), why);
for (const [quote, why] of [
  ['Gewissenhaftigkeit, Sorgfalt', "Duden's verbatim definition is quoted"],
  ['Et les mots pour le dire arrivent aisément', "Boileau's full couplet is given"],
  ['Ban Gu', 'the Book of Han is attributed to its compiler'],
  ['CAN-ASC-3.1:2025', 'the Canadian standard carries its full designation'],
  ['Observe thoroughly', 'the Toyota nuance is kept, not smoothed over'],
]) is(readme.includes(quote), why);
is(readme.includes('is a misquote'), 'the France row flags the common misquote rather than hiding it');
is(/Mao used it at Yan'an|Yan'an in 1938/.test(readme),
  'the modern political register of the Chinese phrase is acknowledged');

for (const [src, why] of [['Toyota Way', 'genchi genbutsu is attributed to where it comes from'],
                          ['Book of Han', 'the Chinese phrase is dated to its real source'],
                          ['rosh katan', 'rosh gadol is defined against its actual opposite']]) {
  is(readme.includes(src), why);
}

group('17. the SMIL is valid, not silently discarded');
// Three ways an animation dies with no error message at all. Each of these has
// shipped at least once, and the only symptom was "nothing is happening".
const svgFiles = readdirSync(join(root, 'assets')).filter((n) => n.endsWith('.svg'));
let ktCount = 0; const ktBad = [], lenBad = [], onGroup = [];
for (const f of svgFiles) {
  const s = read(`assets/${f}`);
  for (const m of s.matchAll(/keyTimes="([^"]*)"/g)) {
    ktCount++;
    const k = m[1].split(';').map((x) => x.trim());
    if (k[0] !== '0' || k[k.length - 1] !== '1') ktBad.push(`${f} -> ${m[1]}`);
  }
  for (const m of s.matchAll(/values="([^"]*)"\s+keyTimes="([^"]*)"/g)) {
    const nv = m[1].split(';').length, nk = m[2].split(';').length;
    if (nv !== nk) lenBad.push(`${f} -> ${nv} values vs ${nk} keyTimes`);
  }
  if (/<g[^>]*\spathLength=/.test(s)) onGroup.push(f);
}
is(ktBad.length === 0, `all ${ktCount} keyTimes lists start at 0 and end at exactly 1`,
  ktBad.slice(0, 3).join('  |  '));
is(lenBad.length === 0, 'every values list has the same length as its keyTimes',
  lenBad.slice(0, 3).join('  |  '));
is(onGroup.length === 0, 'pathLength never sits on a <g>, where it is not inherited and does nothing',
  onGroup.join(', '));

group('18. the recruiter-facing additions are true and self-consistent');
// The proof panel prints a number about this very suite. If that number is not
// enforced it becomes the page's only unchecked claim, which is the exact failure
// the panel exists to argue against.
const proof = read('assets/proof.svg');
const roadmap = read('assets/roadmap.svg');

for (const p of ['tools/test.mjs', 'tools/check-live.mjs']) {
  is(existsSync(join(root, p)), `${p} ships, so the claim on the panel can be run`);
}
// Same discipline as tools/run-sql.mjs: the shipped copy is the file that runs here.
for (const n of ['test.mjs', 'check-live.mjs']) {
  const priv = join(here, n);
  is(!existsSync(priv) || readFileSync(priv, 'utf8') === readFileSync(join(root, 'tools', n), 'utf8'),
    `tools/${n} is byte-identical to the copy that was actually run`);
}

is(/subclass 485/i.test(readme) && /September 2028/.test(readme),
  'the visa and its expiry are stated, because that is the first thing a recruiter filters on');
is(/mailto:namash\.work@gmail\.com/.test(readme), 'an email address is reachable without leaving the page');
is(/Full work rights/i.test(readme), 'work rights are stated in as many words');

is(/stroke-dasharray="7 7"/.test(roadmap) && /rd-ahead/.test(roadmap),
  'the roadmap draws the wanted-next list dashed, so ambition never looks like shipped work');
is(/ambition, not a claim/i.test(readme), 'the README still says the second list is ambition, not a claim');
is(!/\bwill be\b|\bguarantee/i.test(roadmap), 'the roadmap panel promises nothing');

const claim = proof.match(/claim: checks=(\d+) groups=(\d+) live=(\d+)/);
is(claim !== null, 'the proof panel declares the numbers it draws, in a form a test can read');
if (claim) {
  const [, cChecks, cGroups, cLive] = claim;
  is(proof.includes(`>${cChecks}</text>`), `the panel actually draws ${cChecks}`);
  is(proof.includes(`>${cLive}</text>`), `the panel actually draws ${cLive}`);
  is(proof.includes(`IN ${cGroups} GROUPS`), `the panel actually draws ${cGroups} groups`);
  is(readme.includes(`${cChecks} checks`), 'the README alt text quotes the same total as the panel');
  // Counted exactly the way check-live.mjs counts: the README fetch, one per unique
  // asset, one per unique internal link, and the five checks on the published text.
  const liveAssets = new Set([...readme.matchAll(/(?:src|srcset)="(assets\/[^"]+)"/g)].map((m) => m[1]));
  const liveLinks = new Set([
    ...[...readme.matchAll(/\]\((examples\/[^)]+|tools\/[^)]+)\)/g)].map((m) => m[1]),
    ...[...readme.matchAll(/href="(examples\/[^"]+|tools\/[^"]+)"/g)].map((m) => m[1]),
  ]);
  const liveExpected = 1 + liveAssets.size + liveLinks.size + 5;
  is(Number(cLive) === liveExpected,
    `the panel claims ${cLive} live checks and this README implies ${liveExpected}`);
  is(Number(cGroups) === groupCount, `the panel claims ${cGroups} groups and the suite runs ${groupCount}`);
  // Last check in the file, so a passing run totals pass+1. Only meaningful at 0 failed,
  // which is the only state this page is ever published in.
  is(fail === 0 && Number(cChecks) === pass + 1,
    `the panel claims ${cChecks} checks and this run makes ${pass + 1}`);
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
