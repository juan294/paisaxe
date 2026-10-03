import { readFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { runLocalQualification } from './ci-cadence-qualification.mjs';

/** Root-owned private controller is an explicit trust input. Its live namespace
 * inspection/acquisition and credentials are never supplied by app artifacts.
 * The hash binds exact read-back bytes; it does not prove containment itself. */
export async function qualificationCli(args) {
  if ((args.length !== 4 && (args.length !== 5 || args[4] !== 'artifact-smoke')) || !isAbsolute(args[0]) || !/^[a-f0-9]{64}$/.test(args[1]) || !isAbsolute(args[2])
      || !/^[1-9][0-9]*$/.test(args[3]) || Number(args[3]) > 10_800_000) throw Error('Expected private controller, SHA256, evidence directory, deadline milliseconds');
  const [controller, expected, directory] = args, root = await realpath(process.cwd());
  if (await realpath(controller) !== controller || !relative(root, controller).startsWith('..')) throw Error('Root controller must be outside candidate');
  const metadata = await lstat(controller);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || metadata.uid !== process.getuid() || (metadata.mode & 0o077) !== 0 || metadata.size > 1_048_576) throw Error('Private controller identity');
  if (createHash('sha256').update(await readFile(controller)).digest('hex') !== expected) throw Error('Private controller bytes changed');
  const after = await lstat(controller);
  if (after.dev !== metadata.dev || after.ino !== metadata.ino || after.mtimeMs !== metadata.mtimeMs || after.size !== metadata.size) throw Error('Private controller moved');
  const trusted = await import(pathToFileURL(controller).href);
  if (typeof trusted.inspectProfile !== 'function' || typeof trusted.acquireHandoff !== 'function') throw Error('Live controller interface unavailable');
  // Acquisition is parent-owned. This launcher does not start Docker/services or
  // authorize candidate SQL; the controller must finish guard proof beforehand.
  const handoff = await trusted.acquireHandoff();
  if (handoff?.profile?.workspace !== root) throw Error('Controller workspace mismatch');
  return runLocalQualification({ profile: handoff.profile, directory, deadline: performance.now() + Number(args[3]), lighthouseCli: handoff.lighthouseCli, scope: args[4] ?? 'full' }, { inspectProfile: trusted.inspectProfile, secrets: handoff.secrets });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await qualificationCli(process.argv.slice(2));
    console.log(JSON.stringify({ passed: (result.e2e?.passed ?? 0) + (result.visual?.passed ?? 0) + result.proof.passed, originalInactive: result.e2e?.skipped ?? null, scope: result.scope, cleanup: result.cleanup.cleanup, manifestSha256: result.manifest.manifestSha256, nativeQualified: false }));
  } catch { console.error('Local qualification or verified cleanup failed; private evidence retained.'); process.exitCode = 1; }
}
