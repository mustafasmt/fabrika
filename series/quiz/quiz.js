// Kod Quiz serisi — her seed farklı koreografi
(function () {
  const { ease: E, prog: P, clamp, lerp } = C;
  const stage = document.getElementById('stage');
  const bg = document.getElementById('bg');
  const g = bg.getContext('2d');
  const flash = document.getElementById('flash');

  const PALETTES = {
    mor: { acc: '#a78bfa', acc2: '#7c3aed', acc3: '#c4b5fd', bgc: '#0b0714', glow: [124, 58, 237] },
    camgobegi: { acc: '#22d3ee', acc2: '#0e7490', acc3: '#a5f3fc', bgc: '#04101a', glow: [14, 165, 233] },
    pembe: { acc: '#f472b6', acc2: '#be185d', acc3: '#fbcfe8', bgc: '#14060f', glow: [219, 39, 119] },
    kehribar: { acc: '#fbbf24', acc2: '#b45309', acc3: '#fde68a', bgc: '#120c03', glow: [217, 119, 6] },
    zumrut: { acc: '#4ade80', acc2: '#15803d', acc3: '#bbf7d0', bgc: '#03110a', glow: [22, 163, 74] },
  };
  const BGS = ['huzme', 'izgara', 'parcacik', 'aurora', 'yagmur'];
  const INTROS = ['basamak', 'yanlar', 'daktilo', 'zoom', 'bulanik'];
  const TIMERS = ['halka', 'cubuk', 'dev', 'noktalar'];
  const REVEALS = ['parlama', 'muhur', 'cevir', 'tarama'];
  const SWAPS = ['kay', 'cevir', 'bulanik'];
  const CTAS = [
    ['Biliyor muydun?', 'Arkadaşına at 👀'],
    ['Bildin mi?', 'Yorumlara yaz 👇'],
    ['Kaydet,', 'lazım olacak 📌'],
    ['Bildiysen', 'yorumlara 🔥 bırak'],
    ['Arkadaşını', 'etiketle, bilsin 😏'],
  ];

  let S = null; // sahne durumu

  // ---------- sözdizimi renklendirme ----------
  const KW = {
    python: 'def|return|if|else|elif|for|while|in|import|from|class|and|or|not|None|True|False|lambda|is|with|as|pass|break|continue',
    web: 'const|let|var|function|return|if|else|for|while|of|in|typeof|new|null|undefined|true|false|NaN|class|this|await|async',
    rust: 'fn|let|mut|match|if|else|for|while|loop|in|return|impl|struct|enum|use|pub|true|false|as|Some|None|Ok|Err|String|Vec|i32|i64|u8|u32|u64|usize|f64|bool|str|self|Self',
    arduino: 'void|int|float|double|char|bool|byte|long|unsigned|String|const|if|else|for|while|return|true|false|HIGH|LOW|OUTPUT|INPUT|INPUT_PULLUP|sizeof|static',
  };
  let LANG = 'python';
  function hl(line) {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = LANG === 'web' && /^\s*<|^\s*[.#\w-]+\s*\{|^\s*[\w-]+\s*:/.test(line) || LANG === 'web' && /<\/?style|\{.*\}/.test(line);
    let re, kind;
    if (html) {
      re = /(<!--.*?-->|\/\*.*?\*\/)|("[^"]*"|'[^']*')|(<\/?[a-zA-Z][\w-]*|\/?>)|([a-zA-Z-]+)(?==)|([a-zA-Z-]+)(?=\s*:)|(!important)|([.#][\w-]+)/g;
      kind = m => m[1] ? 'cm' : m[2] ? 'str' : m[3] ? 'tag' : m[4] ? 'at' : m[5] ? 'fn' : m[6] ? 'kw' : 'num';
    } else {
      const cm = LANG === 'python' ? '#.*$' : '\\/\\/.*$';
      re = new RegExp(`(${cm})|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|\\b(${KW[LANG] || KW.python})\\b|\\b(\\d+\\.?\\d*(?:UL|L|u8|i32)?)\\b|([A-Za-z_]\\w*!)|([A-Za-z_]\\w*)(?=\\s*\\()|([=+\\-*/%<>!|&]+)`, 'g');
      kind = m => m[1] ? 'cm' : m[2] ? 'str' : m[3] ? 'kw' : m[4] ? 'num' : m[5] ? 'mac' : m[6] ? 'fn' : 'op';
    }
    let out = '', last = 0, m;
    while ((m = re.exec(line))) {
      if (!m[0]) { re.lastIndex++; continue; }
      out += esc(line.slice(last, m.index));
      out += `<span class="tk-${kind(m)}">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + esc(line.slice(last));
  }
  const FILES = { python: 'soru.py', web: 'index.js', rust: 'main.rs', arduino: 'sketch.ino' };
  const QTEXT = { python: 'Bu kod ne yazdırır?', web: 'Konsolda ne yazar?', rust: 'Bu kod ne yazdırır?', arduino: 'Seri monitörde ne görünür?' };
  const LANG_LABEL = { python: 'PYTHON', web: 'WEB', rust: 'RUST', arduino: 'ARDUINO' };
  // ilk n karakteri renkli göster
  function hlPartial(line, n) { return n >= line.length ? hl(line) : hl(line.slice(0, n)); }

  function el(cls, html = '', parent = stage) {
    const d = document.createElement('div');
    d.className = cls; d.innerHTML = C.emojify(html); parent.appendChild(d); return d;
  }
  function setT(e, { o = 1, x = 0, y = 0, s = 1, r = 0, rx = 0, ry = 0, blur = 0 } = {}) {
    e.style.opacity = o;
    e.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
    e.style.filter = blur > 0.05 ? `blur(${blur}px)` : 'none';
  }

  // ---------- kurulum ----------
  async function setup(item, seed, history) {
    const R = C.rng(seed);
    const used = k => history.map(h => h && h[k]).filter(v => v !== undefined && v !== null);
    const d = {
      palet: item.palette || R.fresh(Object.keys(PALETTES), used('palet').slice(-2)),
      zemin: R.fresh(BGS, used('zemin').slice(-2)),
      giris: R.fresh(INTROS, used('giris').slice(-3)),
      sayac: R.fresh(TIMERS, used('sayac').slice(-2)),
      acilis: R.fresh(REVEALS, used('acilis').slice(-2)),
      gecis: R.fresh(SWAPS, used('gecis').slice(-1)),
      kamera: R.fresh(['yaklas', 'uzaklas', 'kay', 'sabit'], used('kamera').slice(-1)),
      sure: R.pick([3, 3, 4]),
      cta: R.fresh([0, 1, 2, 3, 4], used('cta').slice(-3)),
      flas: R.chance(0.5),
    };
    const pal = PALETTES[d.palet];
    for (const [k, v] of Object.entries({ acc: pal.acc, acc2: pal.acc2, acc3: pal.acc3, bgc: pal.bgc }))
      document.documentElement.style.setProperty('--' + k, v);

    stage.innerHTML = '';
    const lines = item.code.split('\n');
    const nOut = item.outputLines ? item.outputLines.length : 1;
    const outLines = item.outputLines || ['# ' + item.output];

    // yerleşim hesabı
    LANG = item.lang || 'python';
    const maxChars = Math.max(...lines.map(l => l.length), ...outLines.map(l => l.length));
    const codeFs = Math.max(24, Math.min(38, Math.floor(868 / (maxChars * 0.602))));
    const codeTop = 600, lh = Math.round(codeFs * 1.55);
    const codeH = 64 + 64 + (lines.length + nOut) * lh;
    const optsTop = codeTop + codeH + 46;
    const nOpt = item.options.length;
    const optsH = nOpt * 112 + (nOpt - 1) * 24;
    const below = optsTop + optsH + 50;
    const fit = Math.min(1, 1530 / (below + 130));

    const badge = el('abs badge', `✱ <b>${item.brand || 'CODECARAVAN'}</b> · ${item.badge || 'GÜNÜN SORUSU'}${item.no ? ' #' + item.no : ''}`);
    const title = el('abs title');
    const mkTitle = (a, b) => `<div class="l1">${a.split(' ').map(w => `<span class="w">${w}</span>`).join('')}</div><div class="l2">${b.split(' ').map(w => `<span class="w${/\p{Extended_Pictographic}/u.test(w) ? ' emo' : ''}">${w}</span>`).join('')}</div>`;
    title.innerHTML = C.emojify(mkTitle(item.title[0], item.title[1]));
    const ctaT = CTAS[d.cta];
    const title2 = el('abs title'); title2.innerHTML = C.emojify(mkTitle(ctaT[0], ctaT[1]));
    const sub = el('abs sub', item.question || QTEXT[LANG] || 'Bu kod ne yazdırır?');
    const code = el('abs code', `<div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span class="fn">${item.file || FILES[LANG] || 'soru.py'}</span></div><pre></pre>`);
    code.querySelector('pre').style.fontSize = codeFs + 'px';
    code.style.top = codeTop + 'px';
    const pre = code.querySelector('pre');
    const opts = el('abs opts'); opts.style.top = optsTop + 'px';
    const optEls = item.options.map((o, i) => {
      const e = el('opt', `<span class="k">${'ABCD'[i]}</span><span class="v" style="font-size:${Math.max(26, Math.min(44, Math.floor(720 / (o.length * 0.602))))}px">${o.replace(/</g, '&lt;')}</span><span class="mark">${i === item.answer ? '✓' : '✕'}</span><span class="sweep"></span>`, opts);
      return e;
    });
    const stamp = el('stamp', 'DOĞRU', opts);
    stamp.style.right = '40px';
    stamp.style.top = (item.answer * 136 + 14) + 'px';
    const explain = el('abs explain', item.explain);
    explain.style.top = (below + 10) + 'px';
    const cta = el('abs cta', `<span class="chip main">${R.pick(['Cevabın? Yorumlara 👇', 'Sence hangisi? 👇', 'Tahminini yaz 👇'])}</span><span class="chip">${'ABCD'.slice(0, nOpt).split('').join(' · ')}</span>`);
    const progEl = el('abs prog', '<i></i>');
    await document.fonts.ready;
    cta.style.top = (below + 10 + explain.offsetHeight + 44) + 'px';
    progEl.style.top = (below + 10 + explain.offsetHeight + 44 + 120) + 'px';

    // sayaç
    let timer;
    if (d.sayac === 'halka') {
      timer = el('timer ring', `<svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="64" fill="rgba(10,6,20,.85)" stroke="rgba(255,255,255,.15)" stroke-width="8"/><circle class="arc" cx="75" cy="75" r="64" fill="none" stroke="${pal.acc}" stroke-width="8" stroke-linecap="round" transform="rotate(-90 75 75)" stroke-dasharray="402" stroke-dashoffset="0"/></svg><div class="num">3</div>`);
      timer.style.left = '880px'; timer.style.top = (codeTop - 70) + 'px';
    } else if (d.sayac === 'cubuk') {
      timer = el('abs', `<div class="tbar-num">3</div><div class="tbar" style="position:relative;margin-top:16px"><i></i></div>`);
      timer.style.top = (below + 20) + 'px';
    } else if (d.sayac === 'dev') {
      timer = el('abs big', '3'); timer.style.top = (below - 10) + 'px';
    } else {
      timer = el('abs dots', '<i></i><i></i><i></i><i></i><i></i>'.slice(0, 7 * d.sure));
      timer.style.top = (below + 40) + 'px';
    }

    // zaman çizelgesi (giriş hızı da değişken)
    const sp = R.range(0.85, 1.15);
    const T = {};
    T.badge = 0.05;
    T.title = 0.15 * sp;
    T.sub = 0.55 * sp;
    T.code = 0.7 * sp;
    const typeChars = lines.join('\n').length;
    T.typeDur = d.giris === 'daktilo' ? Math.min(1.6, typeChars * 0.035) : 0;
    T.opts = T.code + 0.35 + T.typeDur;
    T.optGap = R.range(0.1, 0.16);
    T.count = T.opts + nOpt * T.optGap + 0.45;
    T.reveal = T.count + d.sure;
    T.output = T.reveal + 0.5;
    T.explain = T.reveal + 1.0;
    T.swap = T.reveal + 1.9;
    T.end = T.reveal + R.range(3.9, 4.4);

    const cues = [];
    const cue = (t, type, gain) => cues.push({ t: +t.toFixed(3), type, ...(gain ? { gain } : {}) });
    cue(0.05, 'whoosh');
    cue(T.title, d.giris === 'zoom' ? 'hit' : 'pop', 0.8);
    cue(T.code, 'whoosh', 0.7);
    if (d.giris === 'daktilo') for (let k = 0; k < typeChars; k += 2) cue(T.code + 0.3 + (k / typeChars) * T.typeDur, 'type', 0.7);
    item.options.forEach((_, i) => cue(T.opts + i * T.optGap, 'pop', 0.6));
    for (let k = 0; k < d.sure; k++) cue(T.count + k, k % 2 ? 'tock' : 'tick');
    if (R.chance(0.6)) cue(T.reveal, 'riser', 0.6);
    cue(T.reveal, 'ding');
    if (d.acilis === 'muhur') cue(T.reveal + 0.15, 'thud');
    cue(T.output, 'type', 0.8);
    cue(T.explain, 'pop', 0.6);
    cue(T.swap, 'whoosh', 0.6);

    S = { item, d, pal, R, T, fit, badge, title, title2, sub, code, pre, lines, outLines, opts, optEls, stamp, explain, cta, progEl, timer, typeChars, seed };
    bgInit(d.zemin, R);

    await document.fonts.load('800 92px Poppins');
    await document.fonts.load('400 38px "JetBrains Mono"');
    await document.fonts.load('700 44px "JetBrains Mono"');
    await C.waitImages();
    // başlık sığdırma
    for (const tt of [title, title2]) {
      const w = Math.max(...[...tt.children].map(c => c.offsetWidth));
      if (w > 950) tt.style.fontSize = Math.floor(92 * 950 / w) + 'px';
    }
    await document.fonts.ready;
    frame(0);
    return { duration: T.end, cues, music: { style: 'lofi', gain: 0.5 }, director: d };
  }

  // ---------- arka planlar ----------
  let BGD = null;
  function bgInit(kind, R) {
    BGD = { kind, parts: [], cols: [] };
    const glyphs = ['{ }', '( )', ';', '</>', '=>', '0', '1', '#', '[ ]', '==', '++', '::'];
    for (let i = 0; i < 70; i++) BGD.parts.push({ x: R() * 1080, y: R() * 1920, z: R.range(0.3, 1), g: R.pick(glyphs), sp: R.range(20, 70), ph: R() * 6 });
    for (let i = 0; i < 36; i++) BGD.cols.push({ x: i * 30 + R() * 10, sp: R.range(150, 420), off: R() * 1920, len: R.int(6, 18) });
    BGD.rot = R.range(-1, 1) * 0.05;
    BGD.blobs = Array.from({ length: 4 }, () => ({ x: R() * 1080, y: R() * 1920, r: R.range(380, 700), fx: R.range(0.05, 0.15), fy: R.range(0.05, 0.15), ph: R() * 6, h: R.range(-40, 40) }));
  }
  function bgDraw(t) {
    const [r, gg, b] = S.pal.glow;
    const rgba = a => `rgba(${r},${gg},${b},${a})`;
    g.fillStyle = S.pal.bgc; g.fillRect(0, 0, 1080, 1920);
    const k = BGD.kind;
    if (k === 'huzme') {
      g.save(); g.translate(540, -120); g.rotate(t * BGD.rot);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        g.beginPath(); g.moveTo(0, 0);
        g.arc(0, 0, 2600, a, a + 0.09); g.closePath();
        g.fillStyle = rgba(0.07 + 0.04 * Math.sin(t * 1.3 + i)); g.fill();
      }
      g.restore();
    } else if (k === 'izgara') {
      const hz = 1180;
      const grd = g.createLinearGradient(0, hz - 300, 0, hz + 40); grd.addColorStop(0, 'transparent'); grd.addColorStop(1, rgba(0.35));
      g.fillStyle = grd; g.fillRect(0, hz - 300, 1080, 340);
      g.strokeStyle = rgba(0.45); g.lineWidth = 2;
      for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(540 + i * 22, hz); g.lineTo(540 + i * 260, 1920); g.stroke(); }
      for (let j = 0; j < 16; j++) {
        const p = ((j + t * 0.9) % 16) / 16; const y = hz + Math.pow(p, 2.2) * (1920 - hz);
        g.globalAlpha = p; g.beginPath(); g.moveTo(0, y); g.lineTo(1080, y); g.stroke(); g.globalAlpha = 1;
      }
    } else if (k === 'parcacik') {
      g.textAlign = 'center';
      for (const p of BGD.parts) {
        const y = ((p.y - t * p.sp * p.z) % 1920 + 1920) % 1920;
        g.font = `700 ${Math.round(18 + 34 * p.z)}px "JetBrains Mono"`;
        g.fillStyle = rgba(0.12 + 0.3 * p.z * (0.6 + 0.4 * Math.sin(t * 2 + p.ph)));
        g.fillText(p.g, p.x + Math.sin(t * 0.7 + p.ph) * 20, y);
      }
    } else if (k === 'aurora') {
      for (const bl of BGD.blobs) {
        const x = bl.x + Math.sin(t * bl.fx * 6 + bl.ph) * 200, y = bl.y + Math.cos(t * bl.fy * 6 + bl.ph) * 200;
        const grd = g.createRadialGradient(x, y, 0, x, y, bl.r);
        grd.addColorStop(0, rgba(0.32)); grd.addColorStop(1, 'transparent');
        g.fillStyle = grd; g.fillRect(0, 0, 1080, 1920);
      }
    } else if (k === 'yagmur') {
      g.font = '700 26px "JetBrains Mono"'; g.textAlign = 'center';
      for (const c of BGD.cols) {
        const head = (c.off + t * c.sp) % 2300 - 200;
        for (let j = 0; j < c.len; j++) {
          const y = head - j * 30; if (y < 0 || y > 1920) continue;
          g.fillStyle = rgba(j === 0 ? 0.7 : 0.35 * (1 - j / c.len));
          g.fillText(((Math.floor(t * 8 + j * 7 + c.x) % 2) ? '1' : '0'), c.x, y);
        }
      }
    }
    // vinyet
    const v = g.createRadialGradient(540, 900, 300, 540, 900, 1200);
    v.addColorStop(0, 'transparent'); v.addColorStop(1, 'rgba(0,0,0,.7)');
    g.fillStyle = v; g.fillRect(0, 0, 1080, 1920);
  }

  // ---------- giriş animasyonu (her öğe için) ----------
  function intro(e, t, start, kind, idx = 0) {
    const p = P(t, start, 0.5);
    if (kind === 'basamak') { const q = E.outC(p); return setT(e, { o: q, y: (1 - q) * 70 }); }
    if (kind === 'yanlar') { const q = E.outBack(p); return setT(e, { o: Math.min(1, p * 2), x: (1 - q) * (idx % 2 ? 1100 : -1100) }); }
    if (kind === 'daktilo') { const q = E.outBack(p); return setT(e, { o: Math.min(1, p * 3), s: 0.6 + 0.4 * q }); }
    if (kind === 'zoom') { const q = E.outExpo(p); return setT(e, { o: Math.min(1, p * 2.5), s: 1.6 - 0.6 * q, blur: (1 - q) * 18 }); }
    if (kind === 'bulanik') { const q = E.outC(p); return setT(e, { o: q, blur: (1 - q) * 22, rx: (1 - q) * 70 }); }
  }

  // ---------- kare ----------
  function frame(t) {
    const { d, T, item } = S;
    bgDraw(t);
    const gi = d.giris;

    // kamera
    let cs = 1, cy = 0, cx = 0;
    const life = t / T.end;
    if (d.kamera === 'yaklas') cs = 1 + 0.035 * life;
    if (d.kamera === 'uzaklas') cs = 1.04 - 0.035 * life;
    if (d.kamera === 'kay') cy = -20 * life;
    const punch = P(t, T.reveal, 0.5);
    if (punch > 0 && punch < 1) cs *= 1 + 0.045 * Math.sin(punch * Math.PI);
    if (d.acilis === 'muhur') { const [sx, sy] = C.shake(t, T.reveal + 0.15, 0.4, 16); cx += sx; cy += sy; }
    stage.style.transform = `translate(${cx}px,${cy}px) scale(${cs * S.fit})`;

    flash.style.opacity = d.flas ? 0.35 * (1 - P(t, T.reveal, 0.25)) * (t >= T.reveal ? 1 : 0) : 0;

    intro(S.badge, t, T.badge, gi === 'daktilo' ? 'basamak' : gi);
    // başlık: kelime kelime
    const swapP = P(t, T.swap, 0.55);
    const words = S.title.querySelectorAll('.w');
    words.forEach((w, i) => intro(w, t, T.title + i * 0.07, gi === 'yanlar' ? 'basamak' : gi, i));
    const words2 = S.title2.querySelectorAll('.w');
    // başlık değişimi
    if (d.gecis === 'kay') {
      { const q = P(t, T.swap, 0.3); setT(S.title, { o: 1 - q, x: -E.inQ(q) * 500 }); }
      words2.forEach((w, i) => { const q = E.outBack(P(t, T.swap + 0.15 + i * 0.05, 0.45)); setT(w, { o: Math.min(1, q * 2), x: (1 - q) * 400 }); });
    } else if (d.gecis === 'cevir') {
      setT(S.title, { o: swapP < 0.5 ? 1 : 0, rx: swapP * 90 });
      words2.forEach((w, i) => { const q = E.outC(P(t, T.swap + 0.25 + i * 0.04, 0.4)); setT(w, { o: q > 0 ? 1 : 0, rx: (1 - q) * -90 }); });
    } else {
      setT(S.title, { o: 1 - swapP, blur: swapP * 20 });
      words2.forEach((w, i) => { const q = E.outC(P(t, T.swap + 0.2 + i * 0.06, 0.5)); setT(w, { o: q, blur: (1 - q) * 20, s: 1.2 - 0.2 * q }); });
    }
    if (t < T.swap) S.title.style.opacity = Math.min(1, +S.title.style.opacity || 1);

    intro(S.sub, t, T.sub, gi === 'yanlar' ? 'basamak' : gi);

    // kod penceresi
    if (gi === 'daktilo') {
      const q = E.outC(P(t, T.code, 0.35));
      S.code.style.opacity = q; S.code.style.transform = `scaleY(${0.05 + 0.95 * q})`; S.code.style.filter = 'none';
    } else intro(S.code, t, T.code, gi, 0);
    // kod metni + çıktı
    const nChars = gi === 'daktilo' ? Math.floor(P(t, T.code + 0.3, T.typeDur) * S.typeChars) : 1e9;
    let left = nChars, html = '';
    S.lines.forEach(ln => {
      const n = Math.max(0, Math.min(ln.length, left)); left -= ln.length + 1;
      html += `<span class="ln">${hlPartial(ln, n)}${gi === 'daktilo' && left < 0 && left > -ln.length - 2 && t < T.opts ? '<span class="caret"></span>' : ''}</span>`;
    });
    const outP = P(t, T.output, 0.45);
    S.outLines.forEach(ol => {
      const n = Math.floor(outP * ol.length);
      html += `<span class="ln out">${n > 0 ? ol.slice(0, n).replace(/</g, '&lt;') : ''}${outP > 0 && outP < 1 ? '<span class="caret"></span>' : ''}</span>`;
    });
    S.pre.innerHTML = html;

    // şıklar
    S.optEls.forEach((o, i) => {
      const st = T.opts + i * T.optGap;
      const ok = i === item.answer;
      const rp = P(t, T.reveal + (d.acilis === 'cevir' ? i * 0.12 : 0), 0.45);
      o.classList.toggle('ok', ok && rp > 0.3);
      const mark = o.querySelector('.mark');
      const sweep = o.querySelector('.sweep');
      let base = {};
      if (gi === 'bulanik') { const q = E.outC(P(t, st, 0.5)); base = { o: q, rx: (1 - q) * 80 }; }
      else if (gi === 'zoom') { const q = E.outExpo(P(t, st, 0.5)); base = { o: Math.min(1, q * 2), s: 1.4 - 0.4 * q, blur: (1 - q) * 12 }; }
      else if (gi === 'yanlar') { const q = E.outBack(P(t, st, 0.5)); base = { o: Math.min(1, q * 2), x: (1 - q) * (i % 2 ? 1100 : -1100) }; }
      else if (gi === 'daktilo') { const q = E.outBack(P(t, st, 0.4)); base = { o: Math.min(1, q * 3), s: 0.5 + 0.5 * q }; }
      else { const q = E.outC(P(t, st, 0.5)); base = { o: q, y: (1 - q) * 60 }; }
      // sayaç sırasında hafif nefes
      if (t > T.count && t < T.reveal) base.s = (base.s || 1) * (1 + 0.008 * Math.sin((t - T.count) * 6 + i));
      if (rp > 0) {
        if (d.acilis === 'cevir') base.rx = (base.rx || 0) + E.inOutC(rp) * 360;
        if (!ok) { base.o = (base.o ?? 1) * (1 - 0.6 * E.outC(rp)); if (d.acilis === 'tarama') base.s = 1 - 0.06 * E.outC(rp); }
        else { base.s = (base.s || 1) * (1 + 0.05 * Math.sin(Math.min(1, rp * 1.4) * Math.PI)); }
        mark.style.opacity = E.outC(rp); mark.style.color = ok ? 'var(--ok)' : 'var(--bad)';
        mark.style.transform = `scale(${0.4 + 0.6 * E.outBack(rp)})`;
        o.querySelector('.v').style.textDecoration = !ok && rp > 0.5 ? 'line-through' : 'none';
      } else { mark.style.opacity = 0; o.querySelector('.v').style.textDecoration = 'none'; }
      const sp = P(t, T.reveal - 0.35 + i * 0.08, 0.5);
      sweep.style.opacity = d.acilis === 'tarama' && sp > 0 && sp < 1 ? 1 : 0;
      sweep.style.transform = `translateX(${(sp * 2 - 1) * 100}%)`;
      setT(o, base);
    });
    // mühür
    const stP = P(t, T.reveal + 0.1, 0.3);
    if (d.acilis === 'muhur' && stP > 0) setT(S.stamp, { o: Math.min(1, stP * 3), s: 2.4 - 1.4 * E.outBack(stP), r: -12 });
    else S.stamp.style.opacity = 0;

    // sayaç
    const cp = P(t, T.count, d.sure);
    const remain = Math.min(d.sure, Math.max(1, Math.ceil(d.sure - (t - T.count))));
    const timerOn = t >= T.count - 0.2 && t < T.reveal + 0.3;
    const tin = E.outBack(P(t, T.count - 0.2, 0.3)), tout = P(t, T.reveal, 0.3);
    const secFrac = ((t - T.count) % 1 + 1) % 1;
    if (d.sayac === 'halka') {
      S.timer.querySelector('.num').textContent = remain;
      S.timer.querySelector('.arc').setAttribute('stroke-dashoffset', String(402 * cp));
      setT(S.timer, { o: timerOn ? (1 - tout) : 0, s: tin * (1 + 0.12 * Math.max(0, 1 - secFrac * 4)) });
    } else if (d.sayac === 'cubuk') {
      S.timer.querySelector('.tbar-num').textContent = remain;
      S.timer.querySelector('i').style.width = (100 * (1 - cp)) + '%';
      setT(S.timer, { o: timerOn ? Math.min(1, tin) * (1 - tout) : 0, y: (1 - Math.min(1, tin)) * 30 });
    } else if (d.sayac === 'dev') {
      S.timer.textContent = remain;
      const pulse = E.outBack(Math.min(1, secFrac * 2.5));
      setT(S.timer, { o: timerOn ? (1 - tout) * (0.4 + 0.6 * (1 - secFrac * 0.6)) : 0, s: 0.5 + 0.5 * pulse });
    } else {
      const dots = S.timer.querySelectorAll('i');
      const elapsed = (t - T.count);
      dots.forEach((dt, i) => { const gone = elapsed > i + 1 - 0.001 || (elapsed >= i && secFrac > 0.85); dt.style.opacity = gone ? 0.15 : 1; dt.style.transform = `scale(${gone ? 0.6 : 1 + (elapsed >= i && elapsed < i + 1 ? 0.25 * Math.sin(secFrac * Math.PI) : 0)})`; });
      setT(S.timer, { o: timerOn ? Math.min(1, tin) * (1 - tout) : 0 });
    }

    // açıklama
    const ep = P(t, T.explain, 0.55);
    setT(S.explain, { o: E.outC(ep), y: (1 - E.outC(ep)) * 40 });
    // alt CTA
    const cp2 = E.outBack(P(t, T.explain + 0.25, 0.5));
    setT(S.cta, { o: Math.min(1, cp2 * 2), y: (1 - cp2) * 80 });
    S.progEl.querySelector('i').style.width = (100 * clamp(t / T.end)) + '%';
    setT(S.progEl, { o: Math.min(1, t * 3) });
  }

  window.SERIES = { ready: true, setup, frame };
})();
