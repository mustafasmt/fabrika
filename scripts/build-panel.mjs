// Paneli dist/ klasörüne derler (GitHub Pages bunu yayınlar)
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const D = join(ROOT, 'dist');
rmSync(D, { recursive: true, force: true });
mkdirSync(D, { recursive: true });
const cp = (from, to) => cpSync(join(ROOT, from), join(D, to), { recursive: true });

cp('panel', '.');
cp('series/quiz', 'series/quiz');
cp('engine/common.js', 'engine/common.js');
for (const f of ['@fontsource/inter', '@fontsource/poppins', '@fontsource/jetbrains-mono', '@twemoji/svg']) cp(`node_modules/${f}`, `node_modules/${f}`);
mkdirSync(join(D, 'vendor'), { recursive: true });
cp('node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'vendor/supabase.js');

const url = process.env.SUPABASE_URL || '', anon = process.env.SUPABASE_ANON_KEY || '';
writeFileSync(join(D, 'config.js'), `window.KQ_CONFIG = ${JSON.stringify({ url, anon })};\n`);
writeFileSync(join(D, '.nojekyll'), '');
console.log(`panel derlendi → dist/ ${url ? '' : '(UYARI: SUPABASE_URL boş)'}`);
