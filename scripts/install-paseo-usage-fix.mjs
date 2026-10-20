// Scoped compatibility fix for the packaged Linux Paseo 0.12 usage sources.
// Backups and generated transport contain no subscription/proxy credentials.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, mkdtemp, copyFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targetRoot = process.env.PASEO_BUILTIN_PLUGINS_DIR || '/opt/Paseo/resources/builtin-plugins';
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const backup = join(homedir(), '.local/share/zerosub-backups', `paseo-usage-${stamp}`);
const temporary = await mkdtemp(join(tmpdir(), 'paseo-usage-fix-'));
await mkdir(backup, { recursive: true, mode: 0o700 });
const transport = join(temporary,'accounts-proxy-transport.js');
await build({ entryPoints:[join(root,'server/paseo-usage-transport.ts')], bundle:true, platform:'node', format:'esm', outfile:transport, logLevel:'silent' });
const changes = [];
for (const provider of ['codex','cursor']) {
  const directory = join(targetRoot, `${provider}-usage-source`, 'server');
  const path = join(directory,'usage.ts');
  const original = await readFile(path,'utf8');
  const marker = 'import { usageFetch } from "./accounts-proxy-transport.js";';
  if (!original.includes(marker) && !original.includes('fetchApi: typeof fetch = fetch,')) throw new Error(`Unsupported ${provider} usage source; no files changed`);
  const patched = original.includes(marker) ? original : marker+'\n'+original.replace('fetchApi: typeof fetch = fetch,','fetchApi: typeof fetch = usageFetch(input),');
  await writeFile(join(backup,`${provider}-usage.ts`),original,{mode:0o600});
  try { await copyFile(join(directory,'accounts-proxy-transport.js'),join(backup,`${provider}-transport.js`)); } catch(e) { if(e.code!=='ENOENT') throw e; }
  const staged = join(temporary,`${provider}-usage.ts`);
  await writeFile(staged,patched);
  changes.push({ directory, path, staged });
}
// All source signatures are validated and backed up before modifying either provider.
for (const {directory,path,staged} of changes) {
  execFileSync('sudo',['-n','install','-m','644',transport,join(directory,'accounts-proxy-transport.js')]);
  execFileSync('sudo',['-n','install','-m','644',staged,path]);
}
console.log(`Updated Codex and Cursor usage transport. Backup: ${backup}`);
console.log('Restart Paseo to activate. Reapply after a Paseo update if needed.');
