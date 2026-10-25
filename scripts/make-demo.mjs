/**
 * Generates the OmniCraft demo assets from a scripted transcript:
 *   docs/demo.gif   — animated GIF for the README
 *   docs/demo.html  — self-contained interactive terminal player
 *
 *   npm run demo
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GIFEncoder, quantize, applyPalette } from '../node_modules/gifenc/dist/gifenc.esm.js'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs')

// ── palette (GitHub dark) ────────────────────────────────────────────────
const C = {
  bg: '#0d1117',
  T: '#e6edf3', // normal text / questions
  D: '#8b949e', // dim — submitted answers, funding notices
  B: '#6e7681', // clack bars & borders
  I: '#56d4dd', // cyan — info lines, note titles
  K: '#3fb950', // green — success, shell user
  U: '#58a6ff', // blue — shell path
  W: '#ffffff', // typed commands
  Y: '#d29922', // yellow
}

const B = (t) => ({ c: 'B', t })
const T = (t) => ({ c: 'T', t })
const D = (t) => ({ c: 'D', t })
const I = (t) => ({ c: 'I', t })
const K = (t) => ({ c: 'K', t })
const G = (t) => ({ c: 'G', t })
const U = (t) => ({ c: 'U', t })
const W = (t) => ({ c: 'W', t })

/** clack note box: title row + padded content rows + close row, borders aligned. */
function note(title, rows) {
  const inner = rows.map((spans) => ({
    spans,
    len: spans.reduce((n, s) => n + s.t.length, 0),
  }))
  const w = Math.max(...inner.map((r) => r.len), title.length + 1)
  const lines = [
    [B('◇  '), I(title), B(' ' + '─'.repeat(w - title.length - 3) + '╮')],
    ...inner.map((r) => [
      B('│'),
      ...r.spans,
      B(' '.repeat(w - r.len) + '│'),
    ]),
    [B('├' + '─'.repeat(w) + '╯')],
  ]
  return lines
}

const row = (label, value) => [T('  ' + label.padEnd(13)), D(value)]
const cmd = (text, comment) =>
  comment
    ? [T('  ' + text.padEnd(28)), D(comment)]
    : [T('  ' + text)]

// ── timeline ─────────────────────────────────────────────────────────────
const L = []
const out = (spans, delay = 130) => L.push({ k: 'out', spans, delay })
const pause = (delay) => L.push({ k: 'pause', delay })
const type = (base, text, cls, delay = 30) => L.push({ k: 'type', base, text, cls, delay })
const q = (text) => out([B('◇  '), T(text)], 150)
const a = (text) => out([B('│  '), D(text)], 170)
const info = (text) => out([B('●  '), I(text)], 210)
const step = (text) => out([B('◇  '), T(text)], 260)
const blank = () => out([T('')], 90)
const bar = () => out([B('│')], 80)

// prompt + typed answer
L.push({ k: 'type', base: [G('damascus@Damascus'), B(':'), U('~'), T('$ ')], text: 'npm create omnicraft@latest', cls: 'W', delay: 28 })
pause(420)
out([T('Need to install the following packages:')], 230)
out([T('create-omnicraft@0.1.0')], 230)
L.push({ k: 'type', base: [T('Ok to proceed? (y) ')], text: 'y', cls: 'W', delay: 130 })
pause(300)
blank()
out([D('> npx')], 100)
out([D('> omnicraft')], 100)
blank()
out([B('┌  '), T('⚡ OmniCraft v0.1.0 — craft any stack')], 320)
bar()
q('What is the name of your app?')
L.push({ k: 'type', base: [B('│  ')], text: 'my-app', cls: 'D', delay: 65 })
bar()
q('What are you building?')
a('Web App')
bar()
q('Select a frontend framework:')
a('React')
bar()
info('Language: TypeScript (JavaScript support is coming)')
bar()
q('Full-stack? Adds a backend API, database and ready-made boilerplate.')
a('Yes')
bar()
q('Select a backend runtime:')
a('Node.js')
bar()
q('Select a backend framework:')
a('Express')
bar()
q('Select an ORM:')
a('Prisma')
bar()
info('Database: PostgreSQL (MySQL, SQLite and MongoDB are coming)')
bar()
q('Pick extras:')
a('Tailwind CSS, ESLint + Prettier')
bar()
for (const line of note('Here is what will be generated', [
  row('App:', 'my-app'),
  row('Stack:', 'React (web)'),
  row('Backend:', 'Express + PostgreSQL (Prisma)'),
  row('Extras:', 'Tailwind CSS, ESLint + Prettier'),
  row('Folder:', '/home/damascus/my-app'),
  row('Ports:', 'client 5173 · server 3000'),
])) out(line, 110)
bar()
q('Craft it?')
a('Yes')
bar()
step('Project generated')
bar()
step('Created server/.env')
bar()
step('Git repository initialized')
bar()
q('Install dependencies with npm now?')
a('Yes')
bar()
q('Installing dependencies with npm — live output below (this can take a minute)')
blank()
out([T('added 377 packages, and audited 380 packages in 47s')], 420)
blank()
out([D('98 packages are looking for funding')], 200)
out([D('  run `npm fund` for details')], 140)
blank()
out([K('found 0 vulnerabilities')], 240)
bar()
out([K('◆  '), T('Dependencies installed with npm')], 300)
bar()
for (const line of note('Next steps', [
  cmd('cd my-app'),
  cmd('docker compose up -d', '# start PostgreSQL'),
  cmd('npm run db:push', '# create tables from the schema'),
  cmd('npm run dev'),
])) out(line, 110)
bar()
out([B('│'), T('    client   → http://localhost:5173')], 170)
out([B('│'), T('    server   → http://localhost:3000 (try /api/health)')], 170)
out([B('│'), T('    database → Prisma Studio: npm run db:studio')], 170)
bar()
out([B('└  '), T('Crafted! Happy building ⚡')], 380)
pause(1600)

// ── frame building ───────────────────────────────────────────────────────
const frames = []
let lines = []
const snap = (delay) => frames.push({ lines: lines.map((l) => l.map((s) => ({ ...s }))), delay })

for (const op of L) {
  if (op.k === 'type') {
    lines.push([...op.base])
    for (const ch of op.text) {
      lines[lines.length - 1].push({ c: op.cls, t: ch })
      snap(op.delay)
    }
  } else if (op.k === 'out') {
    lines.push(op.spans)
    snap(op.delay)
  } else if (op.k === 'pause') {
    snap(op.delay)
  }
}

const cols = Math.max(...frames.flatMap((f) => f.lines.map((l) => l.reduce((n, s) => n + s.t.length, 0))))
const FONT = 14
const CHAR_W = 8.05 // Consolas advance ≈ 0.55em
const LINE_H = 20.5
const PAD = 26
const WIDTH = Math.ceil(cols * CHAR_W + PAD * 2)
const HEIGHT = Math.ceil(frames[frames.length - 1].lines.length * LINE_H + PAD * 2)
console.log(`frames: ${frames.length}, cols: ${cols}, canvas: ${WIDTH}x${HEIGHT}`)

function renderSVG(frame) {
  // Every character is positioned on its own grid cell — pixel-perfect
  // alignment regardless of which font fontconfig falls back to for
  // box-drawing glyphs or emoji.
  const text = frame.lines
    .map((line, i) => {
      const y = (PAD + i * LINE_H + FONT).toFixed(1)
      let col = 0
      const glyphs = []
      for (const s of line) {
        for (const ch of s.t) {
          if (ch === '⚡') {
            // no font in the runner's fontconfig draws a clean bolt — draw one
            glyphs.push(
              `<path transform="translate(${(PAD + col * CHAR_W).toFixed(1)},${(PAD + i * LINE_H).toFixed(1)}) scale(0.92)" d="M8 0 L1 9.5 L5.4 9.5 L4.4 16 L11 7 L6.5 7 Z" fill="#d29922"/>`,
            )
          } else if (ch !== ' ') {
            glyphs.push(
              `<text x="${(PAD + col * CHAR_W).toFixed(1)}" y="${y}" fill="${C[s.c]}">${escapeXML(ch)}</text>`,
            )
          }
          col++
        }
      }
      return glyphs.join('')
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <style>text{font-family:'Cascadia Mono',Consolas,'DejaVu Sans Mono',monospace;font-size:${FONT}px}</style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>
  ${text}
</svg>`
}

function escapeXML(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── GIF encoding ─────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true })

// One global palette, derived from the final (fullest) frame — keeps the
// GIF small and every frame color-consistent.
const finalSVG = renderSVG(frames[frames.length - 1])
const { data: finalRGBA } = await sharp(Buffer.from(finalSVG)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const palette = quantize(finalRGBA, 256)

const gif = GIFEncoder()
for (let i = 0; i < frames.length; i++) {
  const svg = renderSVG(frames[i])
  const { data } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const index = applyPalette(data, palette)
  gif.writeFrame(index, WIDTH, HEIGHT, { palette, delay: frames[i].delay })
  if (i === 0 || i === frames.length - 1) {
    await sharp(Buffer.from(svg)).png().toFile(join(OUT, '.preview.png'))
  }
  if (i % 25 === 0) console.log(`  frame ${i}/${frames.length}`)
}
gif.finish()
writeFileSync(join(OUT, 'demo.gif'), gif.bytes())
const { statSync } = await import('node:fs')
console.log(`demo.gif: ${(statSync(join(OUT, 'demo.gif')).size / 1024 / 1024).toFixed(2)} MB`)

// ── interactive HTML player ──────────────────────────────────────────────
const player = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OmniCraft — interactive demo</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#010409;font-family:system-ui,sans-serif}
  .wrap{width:min(96vw,720px)}
  .bar{display:flex;align-items:center;gap:10px;background:#161b22;border:1px solid #30363d;border-bottom:0;border-radius:8px 8px 0 0;padding:8px 12px}
  .dot{width:11px;height:11px;border-radius:50%}
  .bar span{color:#8b949e;font-size:12px;margin-left:6px}
  .bar button{margin-left:auto;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer}
  .bar button:hover{background:#30363d}
  .term{background:${C.bg};border:1px solid #30363d;border-radius:0 0 8px 8px;padding:20px 16px;overflow-x:auto}
  pre{margin:0;font:13px/1.55 Consolas,'Cascadia Mono',monospace;white-space:pre}
  .B{color:${C.B}}.T{color:${C.T}}.D{color:${C.D}}.I{color:${C.I}}.K{color:${C.K}}.G{color:${C.G}}.U{color:${C.U}}.W{color:${C.W}}.Y{color:${C.Y}}
  .cursor{display:inline-block;width:7px;height:14px;background:#e6edf3;vertical-align:-2px;animation:blink 1s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}
</style>
</head>
<body>
<div class="wrap">
  <div class="bar">
    <div class="dot" style="background:#ff5f57"></div><div class="dot" style="background:#febc2e"></div><div class="dot" style="background:#28c840"></div>
    <span>omnicraft — demo</span>
    <button id="replay">↻ Replay</button>
  </div>
  <div class="term"><pre id="out"></pre></div>
</div>
<script>
const TL = ${JSON.stringify(L)};
const CURSOR = '<span class="cursor"></span>';
const out = document.getElementById('out');
let lines = [], timers = [];

function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function span(s){return '<span class="'+s.c+'">'+esc(s.t)+'</span>'}
function render(typing){
  out.innerHTML = lines.map(l=>'<div>'+l.map(span).join('')+'</div>').join('') + (typing?'<div>'+CURSOR+'</div>':'');
  window.scrollTo(0, document.body.scrollHeight);
}
function schedule(fn, delay){ timers.push(setTimeout(fn, delay)) }
function play(){
  timers.forEach(clearTimeout); timers = []; lines = []; out.innerHTML = '';
  let t = 300;
  for (const op of TL){
    if (op.k === 'out'){
      schedule(()=>{ lines.push(op.spans); render(false) }, t); t += Math.max(op.delay, 60);
    } else if (op.k === 'type'){
      schedule(()=>{ lines.push([...op.base]); render(true) }, t);
      for (let i = 1; i <= op.text.length; i++){
        schedule(((n)=>()=>{ lines[lines.length-1] = [...op.base, {c:op.cls, t:op.text.slice(0,n)}]; render(true) })(i), t + i*op.delay);
      }
      t += op.text.length*op.delay + 60;
    } else if (op.k === 'pause'){ t += op.delay }
  }
  schedule(()=>render(false), t + 100);
}
document.getElementById('replay').addEventListener('click', play);
play();
</script>
</body>
</html>
`
writeFileSync(join(OUT, 'demo.html'), player)
console.log('demo.html written')
