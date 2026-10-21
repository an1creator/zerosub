import { readFile, readdir, mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { patchMenuBundle } from './paseo-menu-patch.mjs';
const directory = '/opt/Paseo/resources/app-dist/_expo/static/js/web';
const candidates = (await readdir(directory)).filter(name => /^index-.*\.js$/.test(name));
const changes = [];
let matched = false;
for (const name of candidates) {
  const path = join(directory,name), original = await readFile(path,'utf8');
  if (!original.includes('_e.PluginComposerPills=')) continue;
  matched = true;
  const patched = patchMenuBundle(original);
  if (patched !== original) changes.push({name,path,original,patched});
}
if (!matched) throw new Error('No matching Paseo bundle found; no files changed');
if (!changes.length) { console.log('Menu patch already installed.'); process.exit(0); }
if (changes.length !== 1) throw new Error('Ambiguous Paseo bundle; no files changed');
const backup = join(homedir(),'.local/share/zerosub-backups',`paseo-menu-${Date.now()}`);
await mkdir(backup,{recursive:true,mode:0o700});
const staging = await mkdtemp(join(tmpdir(),'paseo-menu-fix-'));
for (const change of changes) {
  await writeFile(join(backup,change.name),change.original,{mode:0o600});
  const path = join(staging,change.name);
  await writeFile(path,change.patched);
  execFileSync(process.execPath,['--check',path]);
  execFileSync('sudo',['-n','install','-m','644',path,change.path]);
}
console.log(`Menu patch installed. Backup: ${backup}. Reload Paseo's window to activate.`);
