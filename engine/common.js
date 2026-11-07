// Ortak yardımcılar — sayfalara düz <script> ile yüklenir
(function () {
  const C = {};
  C.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    const r = () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.chance = p => r() < p;
    r.shuffle = arr => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    // geçmişte kullanılmayanı tercih et (tekrar engeli)
    r.fresh = (arr, used = []) => { const f = arr.filter(x => !used.includes(x)); return r.pick(f.length ? f : arr); };
    return r;
  };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  C.clamp = clamp;
  C.lerp = (a, b, t) => a + (b - a) * t;
  C.prog = (t, start, dur) => clamp((t - start) / Math.max(dur, 1e-4));
  C.ease = {
    lin: x => x,
    inQ: x => x * x,
    outQ: x => 1 - (1 - x) * (1 - x),
    outC: x => 1 - Math.pow(1 - x, 3),
    inOutC: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outExpo: x => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: x => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outElastic: x => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
    inOutS: x => -(Math.cos(Math.PI * x) - 1) / 2,
  };
  // sarsıntı (deterministik)
  C.shake = (t, start, dur, amp, freq = 38) => {
    const p = C.prog(t, start, dur);
    if (p <= 0 || p >= 1) return [0, 0];
    const k = (1 - p) * (1 - p) * amp;
    return [Math.sin(t * freq * 6.1) * k, Math.cos(t * freq * 4.7 + 1.3) * k];
  };
  C.fmtNum = (n, sep = '.') => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  // emoji → Twemoji SVG (başsız tarayıcıda renkli emoji fontu çizilmiyor)
  C.EMOJI_BASE = '../../node_modules/@twemoji/svg/';
  C.emojify = html => html.replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu, m => {
    let cps = [...m].map(c => c.codePointAt(0).toString(16));
    if (!m.includes('\u200D')) cps = cps.filter(c => c !== 'fe0f');
    return `<img class="emj" src="${C.EMOJI_BASE}${cps.join('-')}.svg" alt="">`;
  });
  C.waitImages = () => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  window.C = C;
})();
