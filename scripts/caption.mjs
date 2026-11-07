// Instagram açıklaması + etiket üretici (yapay zekâsız, kalıp havuzlu)
const LANG_NAME = { python: 'Python', web: 'Web (JS/CSS)', rust: 'Rust', arduino: 'Arduino' };
const LANG_EMO = { python: '🐍', web: '🌐', rust: '🦀', arduino: '🔌' };

function rng(seed) {
  let a = seed >>> 0 || 1;
  const r = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.shuffle = arr => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  return r;
}

const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export function buildCaption(q, { seed = 1, no, hashtags = {} } = {}) {
  const R = rng(seed * 31 + 7);
  const title = q.title.join(' ');
  const L = q.lang;
  const n = q.options.length;
  const letters = 'ABCD'.slice(0, n).split('').join(', ');
  const opener = R.pick([
    `${title}`,
    `${LANG_EMO[L]} ${title}`,
    `Günün sorusu${no ? ' #' + no : ''}: ${title}`,
    `${title} ${R.pick(['👀', '🧠', '⏱️'])}`,
  ]);
  const ask = R.pick([
    `Cevabın hangisi: ${letters}? Yorumlara yaz 👇`,
    `3 saniyen var! Cevabını yorumlara bırak 👇`,
    `Videoyu durdur, tahminini yorumlara yaz, sonra cevaba bak 😏`,
    `Sence ${letters} hangisi? Yorumlarda görüşelim 👇`,
  ]);
  const extra = R.pick([
    `${LANG_EMO[L]} Dil: ${LANG_NAME[L]}`,
    `${LANG_EMO[L]} ${LANG_NAME[L]} bilenler buraya`,
    `💡 Cevap ve açıklama videonun sonunda`,
  ]);
  const cta = R.pick([
    '📌 Kaydet, sonra lazım olur.',
    '👥 Bunu bilmeyen arkadaşını etiketle.',
    '🔁 Her gün yeni bir kod sorusu için takip et.',
    '📌 Kaydet · 👥 Etiketle · 🔁 Takip et',
  ]);
  const pool = [...(hashtags[L] || []), ...(hashtags.ortak || [])];
  const langTags = (hashtags[L] || []).slice(0, 2);
  const rest = R.shuffle(pool.filter(t => !langTags.includes(t))).slice(0, 8 + Math.floor(R() * 4));
  const tags = [...new Set([...langTags, ...rest])].slice(0, 14);
  return `${opener}\n\n${ask}\n${extra}\n\n${cta}\n.\n.\n${tags.join(' ')}`.slice(0, 2150);
}

export { strip };
