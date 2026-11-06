import { open, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { buildImportPlan, applyImportPlan } from '../src/lib/supabase/import-plan';
import { getSupabaseAdmin } from '../src/lib/supabase/admin';
import { getAiSettings } from '../src/lib/ai-settings';
import { getChronopostSettings } from '../src/lib/chronopost-settings';

async function main() {
  if (process.argv.slice(2).some(a => a !== '--apply')) throw new Error('Arguments invalides');
  const root = process.cwd(), lock = path.join(root, '.local/supabase-import.lock');
  await mkdir(path.dirname(lock), {recursive:true});
  const handle = await open(lock, 'wx', 0o600);
  try {
    const plan = await buildImportPlan(root);
    console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run', revision:plan.state.revision, objects:plan.objects.length, labels:plan.labels.length, missingPdfs:plan.missingPdfs, sourceHash:plan.snapshot}));
    if (!process.argv.includes('--apply')) return;
    const client = getSupabaseAdmin();
    const envFile = path.join(root,'.env.local');
    const settings = { ai:await getAiSettings(envFile), chronopost:await getChronopostSettings(envFile) };
    await applyImportPlan(root,plan,client,settings);
    console.log(JSON.stringify({published:true, revision:plan.state.revision, sourceHash:plan.snapshot}));
  } finally {await handle.close();await unlink(lock);}
}
main().catch(()=>{console.error('Import interrompu. Vérifier la configuration, les conflits et le verrou local ; aucune donnée sensible affichée.');process.exitCode=1;});
