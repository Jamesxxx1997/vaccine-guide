// Keep the last complete integrity baseline until the whole next run succeeds.
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export function recordedFetchTime(previous, reused, downloaded, now) {
  if (reused) return null;
  if (previous?.fetched_at) return previous.fetched_at;
  if (downloaded) return now;
  throw Error('Cached PDF has no acquisition record; review provenance before adoption. Do not invent a download time.');
}

export async function commitCompleteManifest(target, manifest) {
  if (!Array.isArray(manifest.failures) || manifest.failures.length) {
    throw Error('Incomplete collection: preserve the previous manifest unchanged');
  }
  // Same-directory rename is atomic: an interrupted run cannot truncate the baseline.
  const temporary = target + '.' + randomUUID() + '.tmp';
  try {
    await fs.writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n', {flag:'wx'});
    await fs.rename(temporary, target);
  } finally {
    await fs.unlink(temporary).catch(e => { if (e.code !== 'ENOENT') throw e; });
  }
}
