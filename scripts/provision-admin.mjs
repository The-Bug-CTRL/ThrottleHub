// Manual operator utility only. Dry-run by default; never called by app/deploy.
import { initializeApp, applicationDefault, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createInterface } from 'node:readline/promises';
import { environment } from './runtime.mjs';
const project = 'throttlehub-9d6b9';
const args = process.argv.slice(2), at = args.indexOf('--uid'), uid = at >= 0 ? args[at + 1] : '';
if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid || '') || args.some((a,i) => a !== '--uid' && a !== '--apply' && i !== at + 1)) throw Error('Usage: node scripts/provision-admin.mjs --uid VERIFIED_UID [--apply]');
const env = environment();
if (env.NEXT_PUBLIC_FIREBASE_MODE !== 'development' || [env.GCLOUD_PROJECT, env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID].some(v => v !== project) || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw Error('Refusing unexpected project or emulator configuration.');
Object.assign(process.env, env);
const app = initializeApp({ projectId: project, credential: applicationDefault() }, 'manual-admin-provisioning');
try {
  const auth = getAuth(app), user = await auth.getUser(uid);
  if (user.disabled) throw Error('Target account is disabled.');
  const claims = user.customClaims || {};
  console.log(JSON.stringify({ project, uid: user.uid, providers: user.providerData.map(p => p.providerId), currentClaimNames: Object.keys(claims).sort(), admin: claims.admin === true }, null, 2));
  if (!args.includes('--apply')) console.log('Read-only check complete. No claims changed. Re-run with --apply only after verifying this UID.');
  else {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw Error('Interactive terminal required for confirmation.');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try { answer = await rl.question(`To add admin:true, type GRANT ${project} ${uid}: `); } finally { rl.close(); }
    if (answer !== `GRANT ${project} ${uid}`) throw Error('Confirmation did not match. No change made.');
    const latest = await auth.getUser(uid);
    if (latest.disabled || JSON.stringify(latest.customClaims || {}) !== JSON.stringify(claims)) throw Error('Account or claims changed during review. Restart and review again.');
    await auth.setCustomUserClaims(uid, { ...claims, admin: true });
    const verified = (await auth.getUser(uid)).customClaims || {};
    if (verified.admin !== true || Object.entries(claims).some(([k,v]) => k !== 'admin' && JSON.stringify(verified[k]) !== JSON.stringify(v))) throw Error('Post-write verification failed; inspect the account before retrying.');
    console.log('Verified admin:true; existing claims preserved. Refresh the browser ID token.');
  }
} catch {
  console.error('Operation did not complete. Check the verified UID, confirmation, approved ADC and Auth IAM permissions. If confirmation was submitted, perform a read-only claim check before retrying. No credentials are printed.');
  process.exitCode = 1;
} finally { await deleteApp(app); }
