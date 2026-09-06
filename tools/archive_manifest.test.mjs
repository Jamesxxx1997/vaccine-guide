import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {commitCompleteManifest, recordedFetchTime} from './archive_manifest.mjs';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'travel-manifest-test-'));
  const file = path.join(directory, 'manifest.json');
  t.after(async () => {
    for (const name of await fs.readdir(directory)) await fs.unlink(path.join(directory, name));
    await fs.rmdir(directory);
  });
  return {directory, file};
}

test('repeated validation failures never erase the original hash or fetch time', async t => {
  const {file} = await fixture(t);
  const baseline = JSON.stringify({documents:[{id:'source', sha256:'original-hash', fetched_at:'2026-09-06T00:00:00Z'}], failures:[]});
  await fs.writeFile(file, baseline);
  for (let run = 0; run < 2; run++) {
    const previous = JSON.parse(await fs.readFile(file, 'utf8'));
    const changedHash = 'tampered-hash';
    assert.notEqual(changedHash, previous.documents[0].sha256);
    await assert.rejects(commitCompleteManifest(file, {
      documents:[], failures:[{id:'source', error:'Archived source changed'}]
    }), /preserve the previous manifest/);
    assert.equal(await fs.readFile(file, 'utf8'), baseline);
  }
});

test('only a complete run atomically replaces the manifest without leaving staging files', async t => {
  const {file, directory} = await fixture(t);
  await fs.writeFile(file, '{"old":true}');
  const complete = {documents:[{id:'source', sha256:'original-hash'}], failures:[]};
  await commitCompleteManifest(file, complete);
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), complete);
  assert.deepEqual(await fs.readdir(directory), ['manifest.json']);
});

test('failed first collection does not create a misleading partial baseline', async t => {
  const {file, directory} = await fixture(t);
  await assert.rejects(commitCompleteManifest(file, {documents:[], failures:[{id:'failed'}]}));
  assert.deepEqual(await fs.readdir(directory), []);
});

test('acquisition dates are preserved, reused sources remain undated, and cache-only dates are never fabricated', () => {
  assert.equal(recordedFetchTime({fetched_at:'original'}, false, false, 'now'), 'original');
  assert.equal(recordedFetchTime(null, true, false, 'now'), null);
  assert.equal(recordedFetchTime(null, false, true, 'now'), 'now');
  assert.throws(() => recordedFetchTime(null, false, false, 'now'), /Do not invent a download time/);
});
