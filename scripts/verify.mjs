// Soru doğrulayıcı: her sorunun kodunu gerçekten çalıştırır, işaretli cevapla karşılaştırır.
// Kullanım: node scripts/verify.mjs [content/bank.json]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const file = process.argv[2] || 'content/bank.json';
const bank = JSON.parse(readFileSync(file, 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'kq-'));
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 60000, ...opts });

const ARDUINO_HARNESS = `#include <cstdio>
#include <string>
#include <cstdint>
typedef uint8_t byte; typedef bool boolean;
struct String { std::string s; String() {} String(const char* c) : s(c) {} String(const std::string& x) : s(x) {}
  String(int v) : s(std::to_string(v)) {} String(long v) : s(std::to_string(v)) {}
  String& operator+=(const String& o) { s += o.s; return *this; } String& operator+=(const char* c) { s += c; return *this; }
  String& operator+=(int v) { s += std::to_string(v); return *this; } String& operator+=(long v) { s += std::to_string(v); return *this; }
  String& operator+=(char c) { s += c; return *this; } };
String operator+(const String& a, const String& b) { return String(a.s + b.s); }
struct SerialT {
  void begin(long) {}
  void print(const char* x) { printf("%s", x); } void print(const String& x) { printf("%s", x.s.c_str()); }
  void print(char c) { printf("%c", c); } void print(int v) { printf("%d", v); } void print(unsigned v) { printf("%u", v); }
  void print(long v) { printf("%ld", v); } void print(unsigned long v) { printf("%lu", v); } void print(double v, int d = 2) { printf("%.*f", d, v); }
  template <class T> void println(T v) { print(v); printf("\\n"); } void println() { printf("\\n"); }
  void println(double v, int d) { print(v, d); printf("\\n"); }
} Serial;
#define int short
void setup() {
__CODE__
}
void loop() {}
#undef int
int main() { setup(); return 0; }
`;

function exec(q) {
  const code = q.code;
  if (q.lang === 'python') { const r = run('python3', ['-c', code]); return { out: r.stdout, err: r.status !== 0 ? r.stderr : null }; }
  if (q.lang === 'web') { const r = run('node', ['-e', code]); return { out: r.stdout, err: r.status !== 0 ? r.stderr : null }; }
  if (q.lang === 'rust') {
    const src = join(tmp, q.id + '.rs'), bin = join(tmp, q.id);
    writeFileSync(src, `#![allow(unused, unused_assignments)]\nfn main() {\n${code}\n}\n`);
    const c = run('rustc', ['-O', '-o', bin, src]);
    if (c.status !== 0) return { compileError: true, err: c.stderr.split('\n')[0] };
    const r = run(bin, []); return { out: r.stdout, err: r.status !== 0 ? r.stderr : null };
  }
  if (q.lang === 'arduino') {
    const src = join(tmp, q.id + '.cpp'), bin = join(tmp, q.id);
    writeFileSync(src, ARDUINO_HARNESS.replace('__CODE__', code));
    const c = run('g++', ['-w', '-o', bin, src]);
    if (c.status !== 0) return { compileError: true, err: c.stderr.split('\n').slice(0, 3).join(' ') };
    const r = run(bin, []); return { out: r.stdout, err: r.status !== 0 ? r.stderr : null };
  }
  return { err: 'bilinmeyen dil' };
}

let cssPage = null, browser = null;
async function cssCheck(q) {
  if (!cssPage) { const { chromium } = await import('playwright'); browser = await chromium.launch(); cssPage = await browser.newPage(); }
  await cssPage.setContent(q.code);
  return cssPage.evaluate(([sel, prop]) => getComputedStyle(document.querySelector(sel))[prop], [q.check.css.selector, q.check.css.prop]);
}

// 16 bit int benzetimi (Arduino Uno sabit ifadeleri)
const int16 = expr => { const v = Function(`return (${expr})`)(); return String(((v + 32768) % 65536 + 65536) % 65536 - 32768); };

let fail = 0;
const norm = (s, ns) => { s = s.replace(/\r/g, '').trim(); return ns ? s.replace(/\s+/g, '') : s; };
for (const q of bank) {
  const ch = q.check || { stdout: q.options[q.answer] };
  let ok = false, got = '';
  try {
    if (ch.css) { got = await cssCheck(q); ok = got === ch.css.expect; }
    else if (ch.int16) { got = int16(ch.int16); ok = got === ch.stdout && q.options[q.answer] === ch.stdout; }
    else {
      const r = exec(q);
      if (ch.compileError) { ok = !!r.compileError; got = r.compileError ? 'derleme hatası ✓ ' + (r.err || '') : 'DERLENDİ: ' + r.out; }
      else { got = norm(r.out || '', false); ok = !r.err && norm(got, ch.normalizeSpaces) === norm(ch.stdout, ch.normalizeSpaces) && norm(q.options[q.answer], ch.normalizeSpaces) === norm(ch.stdout, ch.normalizeSpaces); if (r.err) got += ' | HATA: ' + r.err.slice(0, 120); }
    }
  } catch (e) { got = 'İSTİSNA: ' + e.message; }
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} ${q.id.padEnd(6)} ${q.lang.padEnd(8)} cevap="${q.options[q.answer]}"  çıktı="${String(got).slice(0, 80)}"`);
}
if (browser) await browser.close();
console.log(fail ? `\n${fail} soru HATALI` : `\nTüm ${bank.length} soru doğrulandı ✓`);
process.exit(fail ? 1 : 0);
