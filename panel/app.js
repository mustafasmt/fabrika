// kodquiz.console · panel
const CFG = window.KQ_CONFIG || {};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = s => String(s ?? '').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

if (!CFG.url || !CFG.anon) {
  document.body.innerHTML = '<div class="login"><div class="login-box"><div class="logo">▌kodquiz<span>.console</span></div><div class="err-text">Yapılandırma eksik: GitHub → Settings → Secrets and variables → Actions → Variables kısmına SUPABASE_URL ve SUPABASE_ANON_KEY ekle, sonra "Paneli yayınla" iş akışını yeniden çalıştır.</div></div></div>';
  throw new Error('config yok');
}
const sb = window.supabase.createClient(CFG.url, CFG.anon);

const ST = { planned: 'PLANLANDI', rendering: 'RENDER', ready: 'HAZIR', publishing: 'YAYINLANIYOR', published: 'YAYINDA', failed: 'HATA', canceled: 'İPTAL' };
const ST_TR = { planlandı: 'planned', planlandi: 'planned', render: 'rendering', hazır: 'ready', hazir: 'ready', yayınlanıyor: 'publishing', yayinlaniyor: 'publishing', yayında: 'published', yayinda: 'published', hata: 'failed', iptal: 'canceled' };
const LANGS = { python: 'Python', web: 'Web', rust: 'Rust', arduino: 'Arduino' };
const DAYS = [['Pzt', 1], ['Sal', 2], ['Çar', 3], ['Per', 4], ['Cum', 5], ['Cmt', 6], ['Paz', 0]];
const S = { view: 'takvim', posts: [], questions: [], qmap: {}, ap: null, settings: {}, logs: [], month: new Date(), query: '', upcoming: true };
S.month.setDate(1);

// ---------- yardımcılar ----------
const pad = n => String(n).padStart(2, '0');
const fmt = (ts, o = {}) => new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', ...o });
const hm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toLocalInput = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const ago = ts => { const s = (Date.now() - new Date(ts)) / 1000; return s < 60 ? 'az önce' : s < 3600 ? `${Math.floor(s / 60)} dk önce` : s < 86400 ? `${Math.floor(s / 3600)} sa önce` : `${Math.floor(s / 86400)} gün önce`; };
function toast(msg, bad = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = 'toast'), 3200); }
function modal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBox').innerHTML = ''; }
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
async function must(p) { const { data, error } = await p; if (error) { toast(error.message, true); throw error; } return data; }
const qTitle = q => q ? q.data.title.join(' ') : '—';
const stTag = s => `<span class="st ${s}">[${ST[s] || s}]</span>`;
const langTag = l => `<span class="lang ${l}">${(LANGS[l] || l).toUpperCase()}</span>`;

// ---------- sorgu satırı ----------
function parseQuery(str) {
  const f = { durum: null, dil: null, text: [] };
  const s = str.replace(/^\s*(paylasimlar|paylaşımlar|sorular)\s*(where)?/i, '');
  const re = /(durum|dil|status|lang)\s*(=|:)\s*"?([^"\s]+)"?|("[^"]+"|\S+)/gi;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) { const k = m[1].toLowerCase(), v = m[3].toLowerCase(); if (k === 'durum' || k === 'status') f.durum = ST_TR[v] || v; else f.dil = v; }
    else if (!/^(and|ve|where|order|by)$/i.test(m[4])) f.text.push(m[4].replace(/"/g, '').toLowerCase());
  }
  return f;
}
function postMatch(p, f) {
  const q = S.qmap[p.question_id];
  if (f.durum && p.status !== f.durum) return false;
  if (f.dil && q?.lang !== f.dil) return false;
  const hay = `${p.question_id} ${qTitle(q)} ${p.no || ''}`.toLowerCase();
  return f.text.every(t => hay.includes(t));
}
$('#q').addEventListener('input', e => { S.query = e.target.value; render(); });

// ---------- veri ----------
async function loadAll() {
  const since = new Date(Date.now() - 90 * 86400e3).toISOString();
  const [posts, qs, ap, st, logs] = await Promise.all([
    must(sb.from('posts').select('*').gte('scheduled_at', since).order('scheduled_at')),
    must(sb.from('questions').select('*').order('id')),
    must(sb.from('autopilot').select('*').eq('id', 1).maybeSingle()),
    must(sb.from('settings').select('*')),
    must(sb.from('logs').select('*').order('at', { ascending: false }).limit(60)),
  ]);
  S.posts = posts; S.questions = qs; S.qmap = Object.fromEntries(qs.map(q => [q.id, q])); S.ap = ap;
  S.settings = Object.fromEntries(st.map(r => [r.key, r.value])); S.logs = logs;
  if (!ap) throw new Error('yetki');
}
async function refreshLight() {
  try {
    const since = new Date(Date.now() - 90 * 86400e3).toISOString();
    const [posts, logs] = await Promise.all([
      must(sb.from('posts').select('*').gte('scheduled_at', since).order('scheduled_at')),
      must(sb.from('logs').select('*').order('at', { ascending: false }).limit(60)),
    ]);
    S.posts = posts; S.logs = logs;
    renderChrome();
    if ($('#modal').classList.contains('hidden') && !document.activeElement?.closest('.view')) render();
  } catch {}
}

// ---------- canlı önizleme (render beklemeden) ----------
function livePreview(box, item, seed) {
  box.innerHTML = '<div class="ph-empty">önizleme yükleniyor…</div>';
  const fr = document.createElement('iframe');
  fr.src = 'series/quiz/index.html';
  box.appendChild(fr);
  fr.onload = async () => {
    const w = fr.contentWindow;
    for (let i = 0; i < 50 && !(w.SERIES && w.SERIES.ready); i++) await new Promise(r => setTimeout(r, 100));
    const hist = S.posts.filter(p => p.director).slice(-10).map(p => p.director);
    const plan = await w.SERIES.setup({ brand: S.settings.brand || 'CODECARAVAN', badge: S.settings.badge || 'GÜNÜN SORUSU', ...item }, seed, hist);
    box.querySelector('.ph-empty')?.remove();
    const t0 = performance.now();
    const loop = () => { if (!fr.isConnected) return; w.SERIES.frame(((performance.now() - t0) / 1000) % (plan.duration + 0.8)); requestAnimationFrame(loop); };
    loop();
  };
}

// ---------- kabuk ----------
function renderChrome() {
  const now = Date.now(), today = new Date().toDateString();
  const P = S.posts;
  const c = s => P.filter(p => p.status === s).length;
  const lastLog = S.logs[0];
  $('#sideStats').innerHTML = `
    bugün <b>${P.filter(p => new Date(p.scheduled_at).toDateString() === today && p.status !== 'canceled').length}</b><br>
    hazır <b>${c('ready')}</b> · plan <b>${c('planned')}</b><br>
    onay bekleyen <b>${P.filter(p => !p.approved && !['canceled', 'published'].includes(p.status)).length}</b><br>
    yayında (30g) <b>${P.filter(p => p.status === 'published' && now - new Date(p.published_at) < 30 * 86400e3).length}</b><br>
    hata <b style="color:${c('failed') ? 'var(--err)' : 'inherit'}">${c('failed')}</b><br>
    otopilot <b style="color:${S.ap?.enabled ? 'var(--ok)' : 'var(--dim)'}">${S.ap?.enabled ? 'AÇIK' : 'KAPALI'}</b><br>
    işçi <b>${lastLog ? ago(lastLog.at) : '—'}</b>`;
  $('#logbar').innerHTML = S.logs.slice(0, 6).map(l => `<div class="ln"><span class="t">${new Date(l.at).toLocaleTimeString('tr-TR')}</span> <span class="${l.level === 'info' ? (/yayınlandı|hazır/i.test(l.msg) ? 'ok' : '') : l.level}">${l.level === 'error' ? '✗' : l.level === 'warn' ? '!' : '✓'} ${esc(l.msg)}</span></div>`).join('') || '<div class="ln dim">henüz kayıt yok · işçi ilk çalıştığında burada akacak</div>';
}
document.querySelectorAll('#nav a').forEach(a => a.addEventListener('click', () => {
  document.querySelectorAll('#nav a').forEach(x => x.classList.toggle('on', x === a));
  S.view = a.dataset.view; render();
}));
const HINTS = { takvim: 'filtre: durum = hazır · dil = rust · metin', kuyruk: 'filtre: durum = hata · dil = python · metin', sorular: 'filtre: dil = arduino · metin', otopilot: '', loglar: 'filtre: metin', ayarlar: '' };
function render() {
  $('#qHint').textContent = HINTS[S.view] || '';
  ({ takvim, kuyruk, sorular, otopilot, loglar, ayarlar })[S.view]();
}

// ---------- 01 takvim ----------
function takvim() {
  const f = parseQuery(S.query);
  const m = S.month, y = m.getFullYear(), mo = m.getMonth();
  const first = new Date(y, mo, 1), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d); }
  const byDay = {};
  S.posts.filter(p => postMatch(p, f)).forEach(p => { const k = new Date(p.scheduled_at).toDateString(); (byDay[k] ||= []).push(p); });
  const todayK = new Date().toDateString();
  $('#view').innerHTML = `
    <div class="h"><h2>${m.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</h2>
      <button class="btn small" id="prevM">◀</button><button class="btn small" id="todayM">bugün</button><button class="btn small" id="nextM">▶</button>
      <div class="sp"></div><button class="btn primary" id="newPost">＋ Yeni paylaşım</button></div>
    <div class="cal">${DAYS.map(d => `<div class="dow">${d[0]}</div>`).join('')}
      ${cells.map(d => { const k = d.toDateString(); const ps = byDay[k] || []; return `<div class="day ${d.getMonth() !== mo ? 'other' : ''} ${k === todayK ? 'today' : ''}" data-day="${d.toISOString()}">
        <div class="d">${d.getDate()}</div>${ps.slice(0, 4).map(p => `<div class="chip ${p.status}" data-post="${p.id}" title="${esc(qTitle(S.qmap[p.question_id]))}">${hm(p.scheduled_at)} ${p.approved ? '' : '⏸ '}${(ST[p.status] || '').slice(0, 5)} ${esc(p.question_id)}</div>`).join('')}${ps.length > 4 ? `<div class="pill">+${ps.length - 4} daha</div>` : ''}</div>`; }).join('')}
    </div>`;
  $('#prevM').onclick = () => { S.month.setMonth(S.month.getMonth() - 1); render(); };
  $('#nextM').onclick = () => { S.month.setMonth(S.month.getMonth() + 1); render(); };
  $('#todayM').onclick = () => { S.month = new Date(); S.month.setDate(1); render(); };
  $('#newPost').onclick = () => openNew();
  document.querySelectorAll('.day').forEach(el => el.addEventListener('click', e => {
    const chip = e.target.closest('[data-post]');
    if (chip) return openPost(chip.dataset.post);
    const d = new Date(el.dataset.day); const t = (S.ap?.times || ['19:00'])[0].split(':'); d.setHours(+t[0], +t[1], 0, 0); openNew(d);
  }));
}

// ---------- 02 kuyruk ----------
function kuyruk() {
  const f = parseQuery(S.query);
  const now = Date.now();
  let rows = S.posts.filter(p => postMatch(p, f));
  rows = S.upcoming ? rows.filter(p => new Date(p.scheduled_at) >= now - 3600e3 || ['ready', 'planned', 'rendering', 'publishing', 'failed'].includes(p.status)) : rows.filter(p => new Date(p.scheduled_at) < now).reverse();
  $('#view').innerHTML = `
    <div class="h"><h2>Kuyruk</h2><button class="btn small ${S.upcoming ? 'primary' : ''}" id="tUp">yaklaşanlar</button><button class="btn small ${S.upcoming ? '' : 'primary'}" id="tPast">geçmiş</button>
      <div class="sp"></div><span class="mono dim">${rows.length} kayıt</span><button class="btn primary" id="newPost">＋ Yeni paylaşım</button></div>
    ${rows.length ? `<table><thead><tr><th>tarih</th><th>#</th><th>dil</th><th>soru</th><th>durum</th><th>onay</th><th>kaynak</th></tr></thead><tbody>
    ${rows.map(p => { const q = S.qmap[p.question_id]; return `<tr class="click" data-post="${p.id}"><td class="num">${fmt(p.scheduled_at, { weekday: 'short' })}</td><td class="num">${p.no || '—'}</td><td>${q ? langTag(q.lang) : ''}</td><td>${esc(qTitle(q))}</td><td>${stTag(p.status)}</td><td>${p.approved ? '<span class="ok">✓</span>' : '<span class="warn">⏸ bekliyor</span>'}</td><td class="dim">${p.source === 'autopilot' ? 'otopilot' : 'elle'}</td></tr>`; }).join('')}
    </tbody></table>` : '<div class="empty">kayıt yok · "＋ Yeni paylaşım" ile planla ya da Otopilot\'u aç</div>'}`;
  $('#tUp').onclick = () => { S.upcoming = true; render(); };
  $('#tPast').onclick = () => { S.upcoming = false; render(); };
  $('#newPost').onclick = () => openNew();
  document.querySelectorAll('tr[data-post]').forEach(tr => tr.onclick = () => openPost(tr.dataset.post));
}

// ---------- paylaşım detayı ----------
function openPost(id) {
  const p = S.posts.find(x => x.id === id); if (!p) return;
  const q = S.qmap[p.question_id];
  const locked = ['published', 'publishing'].includes(p.status);
  modal(`
    <div class="h"><h2>Paylaşım ${p.no ? '#' + p.no : ''}</h2>${stTag(p.status)}<div class="sp"></div><button class="btn ghost small" id="x">kapat ✕</button></div>
    <div class="detail">
      <div class="stack"><div class="phone" id="ph">${p.video_url ? `<video src="${esc(p.video_url)}" controls loop playsinline></video>` : '<div class="ph-empty">video henüz üretilmedi<br>işçi en geç 15 dk içinde üretir</div>'}</div>
        <div class="row"><button class="btn small" id="live">▶ canlı önizleme</button>${p.video_url ? `<a class="btn small ghost" href="${esc(p.video_url)}" download>indir</a>` : ''}</div></div>
      <div class="stack">
        <div class="kv">
          <span class="k">soru</span><span>${q ? langTag(q.lang) : ''} ${esc(qTitle(q))} <span class="dim">(${esc(p.question_id)})</span></span>
          <span class="k">kaynak</span><span>${p.source === 'autopilot' ? 'otopilot' : 'elle'} · seed ${p.seed ?? '—'} · deneme ${p.attempts}</span>
          ${p.ig_permalink ? `<span class="k">instagram</span><span><a href="${esc(p.ig_permalink)}" target="_blank">${esc(p.ig_permalink)}</a></span>` : ''}
          ${p.error ? `<span class="k">hata</span><span class="err-text">${esc(p.error)}</span>` : ''}
        </div>
        <div class="grid2">
          <label>paylaşım zamanı<input type="datetime-local" id="when" value="${toLocalInput(p.scheduled_at)}" ${locked ? 'disabled' : ''}></label>
          <label>onay<span class="chk"><input type="checkbox" id="appr" ${p.approved ? 'checked' : ''} ${locked ? 'disabled' : ''}> zamanı gelince paylaşılabilir</span></label>
        </div>
        <label>instagram açıklaması ${p.caption_locked ? '<span class="warn">(elle düzenlendi)</span>' : '<span class="dim">(otomatik)</span>'}
          <textarea id="cap" rows="9" ${locked ? 'disabled' : ''} placeholder="video üretilince otomatik yazılır">${esc(p.caption || '')}</textarea></label>
        <div class="row">
          ${locked ? '' : '<button class="btn primary" id="save">Kaydet</button><button class="btn" id="now">⚡ Şimdi paylaş</button>'}
          ${['planned', 'ready', 'failed'].includes(p.status) ? '<button class="btn" id="regen">↻ Yeniden üret</button>' : ''}
          ${p.status === 'canceled' ? '<button class="btn" id="undo">Geri al</button>' : !locked ? '<button class="btn danger" id="cancel">İptal et</button>' : ''}
        </div>
      </div>
    </div>`);
  $('#x').onclick = closeModal;
  $('#live').onclick = () => livePreview($('#ph'), q.data, p.seed ?? 1);
  const upd = async (patch, msg) => { await must(sb.from('posts').update(patch).eq('id', p.id)); toast(msg); closeModal(); await refreshLight(); render(); };
  if (!locked) {
    $('#save').onclick = () => { const cap = $('#cap').value; const patch = { scheduled_at: new Date($('#when').value).toISOString(), approved: $('#appr').checked }; if (cap !== (p.caption || '')) Object.assign(patch, { caption: cap, caption_locked: true }); upd(patch, 'kaydedildi ✓'); };
    $('#now').onclick = () => upd({ scheduled_at: new Date().toISOString(), approved: true, ...($('#cap').value !== (p.caption || '') ? { caption: $('#cap').value, caption_locked: true } : {}) }, p.video_url ? 'sıradaki işçi turunda paylaşılacak (≤15 dk)' : 'önce video üretilecek, sonra paylaşılacak (≤20 dk)');
  }
  $('#regen') && ($('#regen').onclick = () => upd({ status: 'planned', seed: Math.floor(Math.random() * 1e6), video_url: null, director: null, attempts: 0, error: null, ig_container_id: null }, 'yeni koreografiyle tekrar üretilecek'));
  $('#cancel') && ($('#cancel').onclick = () => { if (confirm('Bu paylaşım iptal edilsin mi?')) upd({ status: 'canceled' }, 'iptal edildi'); });
  $('#undo') && ($('#undo').onclick = () => upd({ status: p.video_url ? 'ready' : 'planned' }, 'geri alındı'));
}

// ---------- yeni paylaşım ----------
function openNew(date) {
  const d = date || (() => { const x = new Date(Date.now() + 3600e3); x.setMinutes(0, 0, 0); return x; })();
  let sel = null, lang = '';
  const seed = Math.floor(Math.random() * 1e6);
  const used = new Set(S.posts.filter(p => !['canceled', 'failed'].includes(p.status)).map(p => p.question_id));
  modal(`
    <div class="h"><h2>Yeni paylaşım</h2><div class="sp"></div><button class="btn ghost small" id="x">kapat ✕</button></div>
    <div class="detail">
      <div class="stack"><div class="phone" id="ph"><div class="ph-empty">soldan bir soru seç<br>canlı önizleme burada</div></div></div>
      <div class="stack">
        <div class="grid2"><label>paylaşım zamanı<input type="datetime-local" id="when" value="${toLocalInput(d)}"></label>
          <label>onay<span class="chk"><input type="checkbox" id="appr" checked> zamanı gelince otomatik paylaş</span></label></div>
        <div class="row"><input id="qs" placeholder="soru ara…" style="flex:1">
          <select id="ql" style="width:140px"><option value="">tüm diller</option>${Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <button class="btn" id="rand">🎲 rastgele</button></div>
        <div class="qlist" id="ql2"></div>
        <div class="row"><button class="btn primary" id="create" disabled>Planla</button><span class="dim mono" id="selInfo"></span></div>
      </div>
    </div>`);
  const list = () => {
    const t = $('#qs').value.toLowerCase();
    const qs = S.questions.filter(q => q.active && (!lang || q.lang === lang) && (`${q.id} ${qTitle(q)}`.toLowerCase().includes(t)));
    $('#ql2').innerHTML = qs.map(q => `<div class="qitem ${sel?.id === q.id ? 'sel' : ''}" data-q="${q.id}">${langTag(q.lang)}<span class="ttl">${esc(qTitle(q))}</span><span class="pill">${used.has(q.id) ? 'planlı · ' : ''}${q.used_count}× ${q.verified ? '✓' : '?'}</span></div>`).join('') || '<div class="empty">eşleşen soru yok</div>';
    document.querySelectorAll('[data-q]').forEach(el => el.onclick = () => pick(S.qmap[el.dataset.q]));
  };
  const pick = q => { sel = q; list(); $('#create').disabled = false; $('#selInfo').textContent = `${q.id} · ${q.verified ? 'doğrulanmış' : 'doğrulanmamış (cevabı kontrol et!)'}`; livePreview($('#ph'), q.data, seed); };
  $('#qs').oninput = list; $('#ql').onchange = e => { lang = e.target.value; list(); };
  $('#rand').onclick = () => { const pool = S.questions.filter(q => q.active && (!lang || q.lang === lang) && !used.has(q.id)).sort((a, b) => a.used_count - b.used_count); const min = pool[0]?.used_count; const c = pool.filter(q => q.used_count === min); if (c.length) pick(c[Math.floor(Math.random() * c.length)]); };
  $('#x').onclick = closeModal;
  $('#create').onclick = async () => {
    await must(sb.from('posts').insert({ question_id: sel.id, scheduled_at: new Date($('#when').value).toISOString(), approved: $('#appr').checked, seed, source: 'manual' }));
    toast('planlandı ✓ video işçi tarafından üretilecek'); closeModal(); await refreshLight(); render();
  };
  list();
}

// ---------- 03 soru havuzu ----------
function sorular() {
  const f = parseQuery(S.query);
  const qs = S.questions.filter(q => (!f.dil || q.lang === f.dil) && f.text.every(t => `${q.id} ${qTitle(q)} ${q.data.code}`.toLowerCase().includes(t)));
  const cnt = l => S.questions.filter(q => q.lang === l && q.active).length;
  $('#view').innerHTML = `
    <div class="h"><h2>Soru Havuzu</h2><span class="mono dim">${Object.keys(LANGS).map(l => `${LANGS[l]} ${cnt(l)}`).join(' · ')}</span><div class="sp"></div><button class="btn primary" id="newQ">＋ Yeni soru</button></div>
    <table><thead><tr><th>id</th><th>dil</th><th>başlık</th><th>kullanım</th><th>son</th><th>doğrulama</th><th>aktif</th></tr></thead><tbody>
    ${qs.map(q => `<tr class="click" data-q="${q.id}"><td class="num">${esc(q.id)}</td><td>${langTag(q.lang)}</td><td>${esc(qTitle(q))}</td><td class="num">${q.used_count}×</td><td class="num">${q.last_used_at ? fmt(q.last_used_at, { hour: undefined, minute: undefined }) : '—'}</td><td>${q.verified ? '<span class="ok">✓ çalıştırıldı</span>' : '<span class="warn">? elle</span>'}</td><td>${q.active ? '<span class="ok">●</span>' : '<span class="dim">○</span>'}</td></tr>`).join('')}
    </tbody></table>`;
  $('#newQ').onclick = () => editQuestion();
  document.querySelectorAll('tr[data-q]').forEach(tr => tr.onclick = () => openQuestion(S.qmap[tr.dataset.q]));
}
function openQuestion(q) {
  const d = q.data;
  const inUse = S.posts.some(p => p.question_id === q.id);
  modal(`
    <div class="h"><h2>${esc(qTitle(q))}</h2>${langTag(q.lang)}<div class="sp"></div><button class="btn ghost small" id="x">kapat ✕</button></div>
    <div class="detail"><div class="stack"><div class="phone" id="ph"></div><button class="btn small" id="again">↻ başka koreografi</button></div>
      <div class="stack">
        <pre class="code">${esc(d.code)}</pre>
        <div class="kv"><span class="k">şıklar</span><span>${d.options.map((o, i) => i === d.answer ? `<b class="ok">${'ABCD'[i]}) ${esc(o)} ✓</b>` : `${'ABCD'[i]}) ${esc(o)}`).join('<br>')}</span>
          <span class="k">açıklama</span><span>${esc(stripTags(d.explain))}</span>
          <span class="k">durum</span><span>${q.verified ? '<span class="ok">✓ kod çalıştırılarak doğrulandı</span>' : '<span class="warn">? panelden eklendi, otomatik doğrulanmadı</span>'} · ${q.used_count}× kullanıldı</span></div>
        <div class="row"><button class="btn primary" id="plan">Bu soruyla planla</button><button class="btn" id="act">${q.active ? 'Pasif yap' : 'Aktif yap'}</button>
          ${q.source === 'panel' ? `<button class="btn" id="edit">Düzenle</button>${inUse ? '' : '<button class="btn danger" id="del">Sil</button>'}` : ''}</div>
      </div></div>`);
  let seed = Math.floor(Math.random() * 1e6);
  livePreview($('#ph'), d, seed);
  $('#again').onclick = () => livePreview($('#ph'), d, ++seed * 7919 % 1e6);
  $('#x').onclick = closeModal;
  $('#plan').onclick = () => { openNew(); setTimeout(() => document.querySelector(`[data-q="${q.id}"]`)?.click(), 50); };
  $('#act').onclick = async () => { await must(sb.from('questions').update({ active: !q.active }).eq('id', q.id)); q.active = !q.active; toast(q.active ? 'aktif' : 'pasif'); closeModal(); render(); };
  $('#edit') && ($('#edit').onclick = () => editQuestion(q));
  $('#del') && ($('#del').onclick = async () => { if (!confirm('Soru silinsin mi?')) return; await must(sb.from('questions').delete().eq('id', q.id)); S.questions = S.questions.filter(x => x.id !== q.id); delete S.qmap[q.id]; toast('silindi'); closeModal(); render(); });
}
function editQuestion(q) {
  const d = q?.data || { lang: 'python', title: ['', ''], code: '', options: ['', '', ''], answer: 0, outputLines: [], explain: '' };
  const lang0 = q?.lang || 'python';
  const toMarks = s => String(s || '').replace(/<br\s*\/?>/g, '\n').replace(/<(b|span[^>]*)>(.*?)<\/(b|span)>/g, '*$2*').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  modal(`
    <div class="h"><h2>${q ? 'Soruyu düzenle' : 'Yeni soru'}</h2><div class="sp"></div><button class="btn ghost small" id="x">kapat ✕</button></div>
    <div class="detail"><div class="stack"><div class="phone" id="ph"><div class="ph-empty">alanları doldur → önizle</div></div><button class="btn small" id="prev">▶ önizle</button>
      <div class="warn mono" style="font-size:12px">⚠ panelden eklenen sorular otomatik doğrulanmaz. Kodu kendin çalıştırıp cevabı kontrol et.</div></div>
      <div class="stack">
        <div class="grid2"><label>dil<select id="f_lang">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === lang0 ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>soru metni (boş = varsayılan)<input id="f_qtext" value="${esc(d.question || '')}" placeholder="Bu kod ne yazdırır?"></label></div>
        <div class="grid2"><label>başlık 1. satır (beyaz)<input id="f_t1" value="${esc(d.title[0])}" placeholder="Python"></label>
          <label>başlık 2. satır (renkli, emoji olabilir)<input id="f_t2" value="${esc(d.title[1])}" placeholder="yuvarlamayı bilmiyor? 🤨"></label></div>
        <label>kod (en fazla ~36 karakter/satır, 8 satır)<textarea id="f_code" rows="6">${esc(d.code)}</textarea></label>
        <div class="grid2">${[0, 1, 2, 3].map(i => `<label>şık ${'ABCD'[i]}${i === 3 ? ' (isteğe bağlı)' : ''}<input id="f_o${i}" value="${esc(d.options[i] || '')}"></label>`).join('')}</div>
        <div class="grid2"><label>doğru şık<select id="f_ans">${[0, 1, 2, 3].map(i => `<option value="${i}" ${d.answer === i ? 'selected' : ''}>${'ABCD'[i]}</option>`).join('')}</select></label>
          <label>çıktı satırları (cevaptan sonra koda eklenir)<textarea id="f_out" rows="2" placeholder="# → 2">${esc((d.outputLines || []).join('\n'))}</textarea></label></div>
        <label>açıklama (*yıldız* = vurgu, yeni satır = alt satır)<textarea id="f_exp" rows="3">${esc(toMarks(d.explain))}</textarea></label>
        <div class="row"><button class="btn primary" id="saveQ">Kaydet</button><span class="err-text" id="qerr"></span></div>
      </div></div>`);
  const collect = () => {
    const opts = [0, 1, 2, 3].map(i => $('#f_o' + i).value.trim()).filter(Boolean);
    const exp = esc($('#f_exp').value.trim()).replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    const item = { id: q?.id || 'p' + Date.now().toString(36), lang: $('#f_lang').value, title: [$('#f_t1').value.trim(), $('#f_t2').value.trim()], code: $('#f_code').value.replace(/\s+$/, ''), options: opts, answer: +$('#f_ans').value, outputLines: $('#f_out').value.split('\n').map(s => s.trimEnd()).filter(Boolean), explain: exp };
    const qt = $('#f_qtext').value.trim(); if (qt) item.question = qt;
    return item;
  };
  const validate = it => !it.title[0] || !it.title[1] ? 'başlığın iki satırını da yaz' : !it.code ? 'kod boş' : it.options.length < 2 ? 'en az 2 şık' : it.answer >= it.options.length ? 'doğru şık boş bir şıkkı gösteriyor' : it.code.split('\n').length > 9 ? 'kod çok uzun (en fazla 9 satır)' : null;
  $('#x').onclick = closeModal;
  $('#prev').onclick = () => { const it = collect(); const e = validate(it); $('#qerr').textContent = e || ''; if (!e) livePreview($('#ph'), it, Math.floor(Math.random() * 1e6)); };
  $('#saveQ').onclick = async () => {
    const it = collect(); const e = validate(it); if (e) return ($('#qerr').textContent = e);
    if (q) await must(sb.from('questions').update({ lang: it.lang, data: it }).eq('id', q.id));
    else await must(sb.from('questions').insert({ id: it.id, lang: it.lang, data: it, source: 'panel', verified: false }));
    S.questions = await must(sb.from('questions').select('*').order('id')); S.qmap = Object.fromEntries(S.questions.map(x => [x.id, x]));
    toast('soru kaydedildi ✓'); closeModal(); render();
  };
}

// ---------- 04 otopilot ----------
function otopilot() {
  const ap = { ...S.ap };
  const draw = () => {
    const daysTxt = ap.days.length === 7 ? 'her gün' : DAYS.filter(d => ap.days.includes(d[1])).map(d => d[0]).join(', ');
    const upcoming = S.posts.filter(p => p.source === 'autopilot' && ['planned', 'ready', 'rendering'].includes(p.status));
    $('#view').innerHTML = `
      <div class="h"><h2>Otopilot</h2><div class="sp"></div><button class="btn primary" id="saveAp">Kaydet</button></div>
      <div class="grid2">
        <div class="card stack">
          <div class="big-toggle"><div class="switch ${ap.enabled ? 'on' : ''}" id="sw"></div>${ap.enabled ? '<span class="ok">Otopilot AÇIK</span>' : '<span class="dim">Otopilot KAPALI</span>'}</div>
          <label>bitiş tarihi (bu güne kadar paylaşır)<input type="date" id="until" value="${ap.until || ''}"></label>
          <label>paylaşım saatleri<div class="times" id="times">${ap.times.map(t => `<span data-t="${t}" title="kaldır">${t} ✕</span>`).join('')}</div>
            <div class="row"><input type="time" id="tNew" value="12:30" style="width:140px"><button class="btn small" id="tAdd">＋ saat ekle</button></div></label>
          <label>günler<div class="row">${DAYS.map(([n, v]) => `<span class="chk"><input type="checkbox" data-day="${v}" ${ap.days.includes(v) ? 'checked' : ''}>${n}</span>`).join('')}</div></label>
          <label>diller<div class="row">${Object.entries(LANGS).map(([k, v]) => `<span class="chk"><input type="checkbox" data-lang="${k}" ${ap.langs.includes(k) ? 'checked' : ''}>${v}</span>`).join('')}</div></label>
          <label>onay<span class="chk"><input type="checkbox" id="req" ${ap.require_approval ? 'checked' : ''}> her videoyu ben onaylayayım (onaylamazsam paylaşılmaz)</span></label>
          <label>ne kadar önceden hazırlansın<select id="hor">${[24, 48, 72].map(h => `<option value="${h}" ${ap.horizon_hours === h ? 'selected' : ''}>${h} saat önceden</option>`).join('')}</select></label>
        </div>
        <div class="card stack">
          <div class="mono" style="font-size:13px;line-height:1.8"><span class="ok">&gt;</span> otopilot.explain()<br>
            ${ap.enabled ? `<span class="ok">●</span> ${ap.until ? `<b>${new Date(ap.until).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</b> tarihine kadar` : '<span class="warn">bitiş tarihi yok, sürekli</span>'} ${daysTxt}, saat <b>${ap.times.join(', ') || '—'}</b>'da
            <b>${ap.langs.map(l => LANGS[l]).join(', ')}</b> sorularından video üretip Instagram'a ${ap.require_approval ? '<span class="warn">senin onayından sonra</span>' : 'otomatik'} atar.<br>
            Videolar paylaşımdan ${ap.horizon_hours} saat önce hazırlanır; panelden izleyip değiştirebilirsin.` : '<span class="dim">○ kapalı · yalnızca elle planladıkların paylaşılır</span>'}</div>
          <div class="mono dim" style="font-size:12px">kuyruktaki otopilot paylaşımları: ${upcoming.length}<br>kullanılmamış aktif soru: ${S.questions.filter(q => q.active && q.used_count === 0 && ap.langs.includes(q.lang)).length}</div>
          ${upcoming.length ? '<button class="btn danger small" id="clearAp">otopilotun planladıklarını iptal et</button>' : ''}
        </div>
      </div>`;
    $('#sw').onclick = () => { ap.enabled = !ap.enabled; draw(); };
    document.querySelectorAll('#times [data-t]').forEach(s => s.onclick = () => { ap.times = ap.times.filter(t => t !== s.dataset.t); draw(); });
    $('#tAdd').onclick = () => { const v = $('#tNew').value; if (v && !ap.times.includes(v)) { ap.times = [...ap.times, v].sort(); draw(); } };
    $('#until').onchange = e => { ap.until = e.target.value || null; draw(); };
    document.querySelectorAll('[data-day]').forEach(c => c.onchange = () => { ap.days = [...document.querySelectorAll('[data-day]:checked')].map(x => +x.dataset.day); draw(); });
    document.querySelectorAll('[data-lang]').forEach(c => c.onchange = () => { ap.langs = [...document.querySelectorAll('[data-lang]:checked')].map(x => x.dataset.lang); draw(); });
    $('#req').onchange = e => { ap.require_approval = e.target.checked; draw(); };
    $('#hor').onchange = e => { ap.horizon_hours = +e.target.value; draw(); };
    $('#saveAp').onclick = async () => {
      if (ap.enabled && (!ap.times.length || !ap.days.length || !ap.langs.length)) return toast('en az bir saat, gün ve dil seç', true);
      const { id, updated_at, ...patch } = ap;
      await must(sb.from('autopilot').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1));
      S.ap = { ...ap }; toast(ap.enabled ? 'otopilot kaydedildi · ilk planlar 15 dk içinde görünür' : 'otopilot kapatıldı'); renderChrome();
    };
    $('#clearAp') && ($('#clearAp').onclick = async () => { if (!confirm('Otopilotun planladığı (henüz paylaşılmamış) tüm videolar iptal edilsin mi?')) return; await must(sb.from('posts').update({ status: 'canceled' }).eq('source', 'autopilot').in('status', ['planned', 'ready'])); await refreshLight(); draw(); toast('iptal edildi'); });
  };
  draw();
}

// ---------- 05 loglar ----------
async function loglar() {
  const f = parseQuery(S.query);
  const logs = await must(sb.from('logs').select('*').order('at', { ascending: false }).limit(300));
  const rows = logs.filter(l => f.text.every(t => l.msg.toLowerCase().includes(t)));
  $('#view').innerHTML = `<div class="h"><h2>Loglar</h2><div class="sp"></div><span class="mono dim">${rows.length} kayıt</span></div>
    <table><thead><tr><th>zaman</th><th>seviye</th><th>mesaj</th></tr></thead><tbody>
    ${rows.map(l => `<tr ${l.post_id ? `class="click" data-post="${l.post_id}"` : ''}><td class="num">${fmt(l.at, { second: '2-digit' })}</td><td class="st ${l.level === 'error' ? 'failed' : l.level === 'warn' ? 'planned' : 'published'}">${l.level.toUpperCase()}</td><td>${esc(l.msg)}</td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('tr[data-post]').forEach(tr => tr.onclick = () => openPost(tr.dataset.post));
}

// ---------- 06 ayarlar ----------
function ayarlar() {
  const st = S.settings, tags = st.hashtags || {};
  const lastPub = S.posts.filter(p => p.status === 'published').sort((a, b) => new Date(b.published_at) - new Date(a.published_at))[0];
  $('#view').innerHTML = `
    <div class="h"><h2>Ayarlar</h2><div class="sp"></div><button class="btn primary" id="saveSt">Kaydet</button></div>
    <div class="grid2">
      <div class="card stack">
        <label>rozet: marka<input id="s_brand" value="${esc(st.brand || 'CODECARAVAN')}"></label>
        <label>rozet: yazı<input id="s_badge" value="${esc(st.badge || 'GÜNÜN SORUSU')}"></label>
        <label>soru numarası başlangıcı (önceki videoların sayısı)<input type="number" id="s_off" value="${+st.no_offset || 0}"></label>
        <div class="mono dim" style="font-size:12px;line-height:1.8">son instagram paylaşımı: ${lastPub ? `<a href="${esc(lastPub.ig_permalink || '#')}" target="_blank">${fmt(lastPub.published_at)}</a>` : '—'}<br>işçi son çalışma: ${S.logs[0] ? ago(S.logs[0].at) : '—'}<br>instagram anahtarı: GitHub Secrets'ta (IG_TOKEN), işçi haftada bir otomatik yeniler</div>
      </div>
      <div class="card stack">
        ${['ortak', 'python', 'web', 'rust', 'arduino'].map(k => `<label>etiketler · ${k}<textarea data-tag="${k}" rows="2">${esc((tags[k] || []).join(' '))}</textarea></label>`).join('')}
      </div>
    </div>`;
  $('#saveSt').onclick = async () => {
    const h = {}; document.querySelectorAll('[data-tag]').forEach(t => h[t.dataset.tag] = t.value.split(/\s+/).filter(Boolean).map(x => x.startsWith('#') ? x : '#' + x));
    const rows = [{ key: 'brand', value: $('#s_brand').value.trim() }, { key: 'badge', value: $('#s_badge').value.trim() }, { key: 'no_offset', value: +$('#s_off').value || 0 }, { key: 'hashtags', value: h }];
    await must(sb.from('settings').upsert(rows));
    rows.forEach(r => (S.settings[r.key] = r.value)); toast('ayarlar kaydedildi ✓');
  };
}

// ---------- giriş ----------
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { $('#login').classList.remove('hidden'); $('#app').classList.add('hidden'); return; }
  try { await loadAll(); }
  catch (e) { await sb.auth.signOut(); $('#login').classList.remove('hidden'); $('#loginErr').textContent = e.message === 'yetki' ? 'Bu e-postanın panel yetkisi yok (admins tablosuna ekle).' : e.message; return; }
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  renderChrome(); render();
  clearInterval(boot._i); boot._i = setInterval(refreshLight, 20000);
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('#loginErr').textContent = '';
  const f = new FormData(e.target);
  const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
  if (error) return ($('#loginErr').textContent = error.message === 'Invalid login credentials' ? 'e-posta veya şifre yanlış' : error.message);
  boot();
});
$('#logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
boot();
