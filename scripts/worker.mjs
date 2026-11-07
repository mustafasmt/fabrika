// Kod Quiz Fabrikası · işçi
// GitHub Actions her 15 dakikada çalıştırır.
//   node scripts/worker.mjs --light   → soru senkronu, otopilot planı, Instagram paylaşımı, token yenileme (bağımlılık gerekmez)
//   node scripts/worker.mjs --render  → videosu hazır olmayanları render eder, sonra paylaşımı tekrar dener
// Ortam değişkenleri: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IG_TOKEN, (IG_USER_ID: boşsa token'dan bulunur), (IG_API_VERSION), (DRY_RUN=1)
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCaption } from './caption.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODE = process.argv.includes('--render') ? 'render' : 'light';
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
let IG_USER_ID = process.env.IG_USER_ID || '';
const IG_VER = process.env.IG_API_VERSION || 'v25.0';
// Instagram girişli token (IGAA…) → graph.instagram.com · Facebook/sistem kullanıcısı token'ı (EAA…) → graph.facebook.com
const isIgToken = t => /^IG/.test(t || '');
const igBase = t => process.env.IG_API_BASE || (isIgToken(t) ? 'https://graph.instagram.com' : 'https://graph.facebook.com');
const DRY = process.env.DRY_RUN === '1';
const RENDER_AHEAD_H = +(process.env.RENDER_AHEAD_HOURS || 48);
const MAX_RENDER = +(process.env.MAX_RENDER || 4);
if (!SUPABASE_URL || !KEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY eksik'); process.exit(1); }

// ---------- Supabase REST ----------
async function fetchRetry(url, opts, n = 3) {
  for (let i = 0; ; i++) {
    try { return await fetch(url, opts); }
    catch (e) { if (i >= n - 1) throw new Error(`ağ hatası: ${e.cause?.code || e.cause?.message || e.message} (${String(url).split('?')[0]})`); await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
}
// yeni anahtarlar (sb_secret_…) JWT değildir: sadece apikey başlığında gönderilir
const H = { apikey: KEY, ...(KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${KEY}` }), 'Content-Type': 'application/json' };
async function api(path, { method = 'GET', body, prefer, headers = {} } = {}) {
  const r = await fetchRetry(`${SUPABASE_URL}${path}`, { method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}), ...headers }, body: body === undefined ? undefined : (typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body)) });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} → ${r.status} ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}
const db = {
  sel: (t, q = '') => api(`/rest/v1/${t}?${q}`),
  ins: (t, rows, prefer = 'return=representation') => api(`/rest/v1/${t}`, { method: 'POST', body: rows, prefer }),
  upd: (t, q, patch) => api(`/rest/v1/${t}?${q}`, { method: 'PATCH', body: patch, prefer: 'return=representation' }),
};
async function log(msg, level = 'info', post_id = null) {
  console.log(`[${level}] ${msg}`);
  try { await db.ins('logs', [{ msg: String(msg).slice(0, 1000), level, post_id }], 'return=minimal'); } catch (e) { console.error('log yazılamadı', e.message); }
}
const nowIso = () => new Date().toISOString();

// ---------- saat dilimi ----------
function tzOffsetMin(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}
function zonedToUtc(ymd, hm, tz) {
  const [y, m, d] = ymd.split('-').map(Number), [hh, mm] = hm.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return new Date(guess.getTime() - tzOffsetMin(guess, tz) * 60000);
}
function ymdIn(date, tz) { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function dowIn(date, tz) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date)); }

// ---------- 1) soru bankası senkronu ----------
async function syncBank() {
  const bank = JSON.parse(readFileSync(join(ROOT, 'content/bank.json'), 'utf8'));
  const rows = bank.map(q => ({ id: q.id, lang: q.lang, data: q, source: 'banka', verified: true }));
  await api('/rest/v1/questions?on_conflict=id', { method: 'POST', body: rows, prefer: 'resolution=ignore-duplicates,return=minimal' });
}

// ---------- 2) otopilot ----------
async function pickQuestion(langs, exclude, recentLangs = []) {
  const qs = await db.sel('questions', `select=id,lang,used_count,last_used_at&active=eq.true&lang=in.(${langs.join(',')})&order=used_count.asc,last_used_at.asc.nullsfirst`);
  let pool = qs.filter(q => !exclude.has(q.id));
  if (!pool.length) pool = qs;
  if (!pool.length) return null;
  const minUse = pool[0].used_count;
  let cands = pool.filter(q => q.used_count <= minUse);
  // son kullanılan dillerden kaçın → diller sırayla döner
  for (let k = Math.min(recentLangs.length, langs.length - 1); k > 0; k--) {
    const avoid = new Set(recentLangs.slice(-k));
    const other = pool.filter(q => !avoid.has(q.lang));
    if (other.length) { const mu = Math.min(...other.map(q => q.used_count)); cands = other.filter(q => q.used_count === mu); break; }
  }
  return cands[Math.floor(Math.random() * cands.length)];
}
async function autopilot() {
  const [ap] = await db.sel('autopilot', 'id=eq.1');
  if (!ap || !ap.enabled) return;
  const tz = ap.tz || 'Europe/Istanbul';
  const now = new Date();
  if (ap.until && ymdIn(now, tz) > ap.until) { await db.upd('autopilot', 'id=eq.1', { enabled: false }); return log(`Otopilot bitiş tarihine (${ap.until}) ulaştı, kapatıldı.`); }
  const horizon = new Date(now.getTime() + (ap.horizon_hours || 48) * 3600e3);
  const existing = await db.sel('posts', `select=id,scheduled_at,question_id,status&status=neq.canceled&scheduled_at=gte.${new Date(now.getTime() - 3600e3).toISOString()}`);
  const taken = new Set(existing.map(p => new Date(p.scheduled_at).getTime()));
  const reserved = new Set(existing.filter(p => !['published', 'failed'].includes(p.status)).map(p => p.question_id));
  const lastPosts = await db.sel('posts', 'select=questions(lang)&status=neq.canceled&order=scheduled_at.desc&limit=3');
  const recentLangs = lastPosts.map(p => p.questions?.lang).filter(Boolean).reverse();
  let made = 0;
  for (let day = 0; day < 10; day++) {
    const d = new Date(now.getTime() + day * 86400e3);
    const ymd = ymdIn(d, tz);
    if (ap.until && ymd > ap.until) break;
    if (!(ap.days || []).includes(dowIn(zonedToUtc(ymd, '12:00', tz), tz))) continue;
    for (const hm of ap.times || []) {
      const at = zonedToUtc(ymd, hm, tz);
      if (at <= now || at > horizon || taken.has(at.getTime())) continue;
      const q = await pickQuestion(ap.langs?.length ? ap.langs : ['python', 'web', 'rust', 'arduino'], reserved, recentLangs);
      if (!q) { await log('Otopilot: uygun soru kalmadı!', 'warn'); return; }
      reserved.add(q.id); taken.add(at.getTime()); recentLangs.push(q.lang);
      await db.ins('posts', [{ question_id: q.id, scheduled_at: at.toISOString(), source: 'autopilot', approved: !ap.require_approval, seed: Math.floor(Math.random() * 1e6) }], 'return=minimal');
      made++;
    }
  }
  if (made) await log(`Otopilot ${made} yeni paylaşım planladı.`);
}

// ---------- 3) render ----------
async function settingsMap() { return Object.fromEntries((await db.sel('settings', 'select=key,value')).map(r => [r.key, r.value])); }
async function needsRender() {
  const until = new Date(Date.now() + RENDER_AHEAD_H * 3600e3).toISOString();
  const rows = await db.sel('posts', `select=id&status=eq.planned&scheduled_at=lte.${until}&limit=1`);
  return rows.length > 0;
}
async function renderDue() {
  const until = new Date(Date.now() + RENDER_AHEAD_H * 3600e3).toISOString();
  const posts = await db.sel('posts', `select=*,questions(*)&status=eq.planned&scheduled_at=lte.${until}&order=scheduled_at.asc&limit=${MAX_RENDER}`);
  if (!posts.length) return;
  const S = await settingsMap();
  const hist = (await db.sel('posts', 'select=director&director=not.is.null&order=rendered_at.desc&limit=10')).map(p => p.director).reverse();
  const tmp = mkdtempSync(join(tmpdir(), 'kq-'));
  for (const p of posts) {
    const lock = await db.upd('posts', `id=eq.${p.id}&status=eq.planned`, { status: 'rendering' });
    if (!lock.length) continue;
    try {
      const before = await db.sel('posts', `select=id&status=not.in.(canceled,failed)&scheduled_at=lt.${new Date(p.scheduled_at).toISOString()}`);
      const no = (S.no_offset || 0) + before.length + 1;
      const seed = p.seed ?? Math.floor(Math.random() * 1e6);
      const item = { ...p.questions.data, no, brand: S.brand || 'CODECARAVAN', badge: S.badge || 'GÜNÜN SORUSU' };
      const itemFile = join(tmp, `${p.id}.json`), histFile = join(tmp, 'hist.json'), out = join(tmp, `${p.id}.mp4`);
      writeFileSync(itemFile, JSON.stringify(item)); writeFileSync(histFile, JSON.stringify(hist));
      execFileSync('node', [join(ROOT, 'engine/render.mjs'), '--series', 'quiz', '--item', itemFile, '--seed', String(seed), '--history', histFile, '--out', out], { stdio: 'inherit', cwd: ROOT });
      const meta = JSON.parse(readFileSync(out.replace(/\.mp4$/, '.meta.json'), 'utf8'));
      hist.push(meta.director);
      const path = `${p.id}.mp4`;
      await api(`/storage/v1/object/videos/${path}`, { method: 'POST', body: readFileSync(out), headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true', 'Cache-Control': 'max-age=3600' } });
      const video_url = `${SUPABASE_URL}/storage/v1/object/public/videos/${path}?v=${Date.now()}`;
      const patch = { status: 'ready', seed, no, director: meta.director, video_path: path, video_url, rendered_at: nowIso(), error: null };
      if (!p.caption_locked) patch.caption = buildCaption(item, { seed, no, hashtags: S.hashtags || {} });
      await db.upd('posts', `id=eq.${p.id}`, patch);
      await log(`Video hazır: #${no} ${item.id} (${item.lang})`, 'info', p.id);
    } catch (e) {
      const attempts = (p.attempts || 0) + 1;
      await db.upd('posts', `id=eq.${p.id}`, { status: attempts < 3 ? 'planned' : 'failed', attempts, error: String(e.message).slice(0, 800) });
      await log(`Render hatası (${attempts}/3): ${e.message}`, 'error', p.id);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}

// ---------- 4) Instagram ----------
async function igToken() {
  const rows = await db.sel('secrets', 'key=in.(ig_token,ig_token_refreshed_at)');
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return { token: m.ig_token || process.env.IG_TOKEN, refreshedAt: m.ig_token_refreshed_at };
}
async function saveSecret(key, value) { await api('/rest/v1/secrets?on_conflict=key', { method: 'POST', body: [{ key, value, updated_at: nowIso() }], prefer: 'resolution=merge-duplicates,return=minimal' }); }
async function refreshToken() {
  const { token, refreshedAt } = await igToken();
  if (!token || !isIgToken(token)) return; // sistem kullanıcısı token'ı süresiz, yenileme gerekmez
  if (refreshedAt && Date.now() - new Date(refreshedAt).getTime() < 7 * 86400e3) return;
  if (DRY) return;
  const r = await fetch(`${igBase(token)}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
  const j = await r.json();
  if (j.access_token) { await saveSecret('ig_token', j.access_token); await saveSecret('ig_token_refreshed_at', nowIso()); await log(`Instagram anahtarı yenilendi (${Math.round((j.expires_in || 0) / 86400)} gün geçerli).`); }
  else await log(`Instagram anahtarı yenilenemedi: ${JSON.stringify(j).slice(0, 300)}`, 'warn');
}
async function igConnect() {
  // IG_USER_ID verilmediyse token'dan bulur, ilk bağlantıda hesabı loglar
  const { token } = await igToken();
  if (!token) return;
  const rows = await db.sel('secrets', 'key=in.(ig_user_id,ig_username)');
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
  if (!IG_USER_ID && m.ig_user_id) IG_USER_ID = m.ig_user_id;
  if (IG_USER_ID && m.ig_username) return;
  let j;
  if (isIgToken(token)) {
    j = await (await fetchRetry(`${igBase(token)}/${IG_VER}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(token)}`)).json();
  } else {
    if (!IG_USER_ID) return log('IG_USER_ID secret eksik (Facebook türü token kullanılıyor, Instagram hesap ID gerekli)', 'error');
    j = await (await fetchRetry(`${igBase(token)}/${IG_VER}/${IG_USER_ID}?fields=username&access_token=${encodeURIComponent(token)}`)).json();
  }
  if (j.error) return log(`Instagram bağlantısı kurulamadı: ${j.error.message}`, 'error');
  IG_USER_ID = IG_USER_ID || String(j.user_id || j.id);
  await saveSecret('ig_user_id', IG_USER_ID); await saveSecret('ig_username', j.username || '?');
  await log(`Instagram bağlandı: @${j.username} (${j.account_type || 'hesap'}, id ${IG_USER_ID})`);
}
async function ig(path, params, method = 'POST') {
  const { token } = await igToken();
  if (!token || !IG_USER_ID) throw new Error('Instagram bağlı değil (IG_TOKEN secret eksik ya da geçersiz)');
  const url = new URL(`${igBase(token)}/${IG_VER}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: token });
  const r = method === 'GET' ? await fetch(`${url}?${body}`) : await fetch(url, { method, body });
  const j = await r.json();
  if (j.error) throw new Error(`Instagram: ${j.error.message} (${j.error.code}${j.error.error_subcode ? '/' + j.error.error_subcode : ''})`);
  return j;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function publishDue() {
  const posts = await db.sel('posts', `select=*,questions(id,used_count)&status=eq.ready&approved=eq.true&scheduled_at=lte.${nowIso()}&order=scheduled_at.asc&limit=3`);
  for (const p of posts) {
    const lock = await db.upd('posts', `id=eq.${p.id}&status=eq.ready`, { status: 'publishing' });
    if (!lock.length) continue;
    try {
      if (DRY) { await db.upd('posts', `id=eq.${p.id}`, { status: 'published', published_at: nowIso(), ig_permalink: 'https://instagram.com/(deneme)' }); await log(`[DENEME] #${p.no} paylaşılmış sayıldı`, 'info', p.id); continue; }
      let container = p.ig_container_id;
      if (!container) {
        const c = await ig(`${IG_USER_ID}/media`, { media_type: 'REELS', video_url: p.video_url, caption: p.caption || '', share_to_feed: 'true' });
        container = c.id;
        await db.upd('posts', `id=eq.${p.id}`, { ig_container_id: container });
      }
      let status = 'IN_PROGRESS';
      for (let i = 0; i < 36 && status !== 'FINISHED'; i++) {
        const s = await ig(container, { fields: 'status_code,status' }, 'GET');
        status = s.status_code;
        if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Instagram videoyu işleyemedi: ${s.status || status}`);
        if (status !== 'FINISHED') await sleep(10000);
      }
      if (status !== 'FINISHED') { await db.upd('posts', `id=eq.${p.id}`, { status: 'ready' }); await log('Instagram işleme sürüyor, sonraki turda yayınlanacak.', 'warn', p.id); continue; }
      const pub = await ig(`${IG_USER_ID}/media_publish`, { creation_id: container });
      let permalink = null;
      try { permalink = (await ig(pub.id, { fields: 'permalink' }, 'GET')).permalink; } catch {}
      await db.upd('posts', `id=eq.${p.id}`, { status: 'published', ig_media_id: pub.id, ig_permalink: permalink, published_at: nowIso(), error: null });
      await db.upd('questions', `id=eq.${p.question_id}`, { used_count: (p.questions?.used_count || 0) + 1, last_used_at: nowIso() });
      await log(`Instagram'da yayınlandı: #${p.no} ${permalink || pub.id}`, 'info', p.id);
    } catch (e) {
      const attempts = (p.attempts || 0) + 1;
      const expired = /container|expired|EXPIRED/i.test(e.message);
      await db.upd('posts', `id=eq.${p.id}`, { status: attempts < 3 ? 'ready' : 'failed', attempts, error: String(e.message).slice(0, 800), ...(expired ? { ig_container_id: null } : {}) });
      await log(`Paylaşım hatası (${attempts}/3): ${e.message}`, 'error', p.id);
    }
  }
}

// ---------- 5) eski videoları temizle (45 gün) ----------
async function cleanup() {
  const old = await db.sel('posts', `select=id,video_path&status=eq.published&video_path=not.is.null&published_at=lt.${new Date(Date.now() - 45 * 86400e3).toISOString()}&limit=50`);
  if (!old.length) return;
  await api('/storage/v1/object/videos', { method: 'DELETE', body: { prefixes: old.map(p => p.video_path) } });
  for (const p of old) await db.upd('posts', `id=eq.${p.id}`, { video_path: null });
}

// ---------- akış ----------
function setOutput(k, v) { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); }
try {
  if (MODE === 'light') {
    await syncBank();
    await autopilot();
    await refreshToken();
    await igConnect();
    await publishDue();
    await cleanup();
    const need = await needsRender();
    setOutput('render', need ? 'true' : 'false');
    console.log(need ? '→ render gerekiyor' : '→ render gerekmiyor');
  } else {
    await renderDue();
    await igConnect();
    await publishDue();
  }
} catch (e) {
  await log(`İşçi hatası: ${e.message}`, 'error');
  process.exit(1);
}
