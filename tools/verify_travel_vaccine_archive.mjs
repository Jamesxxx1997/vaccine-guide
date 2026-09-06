#!/usr/bin/env node
// Offline integrity and bibliography checks, not clinical-content certification.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'sources/旅遊疫苗/2026-09-06');
const spec = JSON.parse(await fs.readFile(path.join(base, 'catalogue.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(base, 'manifest.json'), 'utf8'));
const readme = await fs.readFile(path.join(base, 'README.md'), 'utf8');
assert.deepEqual(manifest.failures, [], 'Unresolved downloads');
assert.equal(new Set(spec.documents.map(d => d.id)).size, spec.documents.length, 'Duplicate catalogue IDs');
assert.equal(new Set(manifest.documents.map(d => d.id)).size, manifest.documents.length, 'Duplicate manifest IDs');
assert.deepEqual(spec.documents.map(d => d.id).sort(), manifest.documents.map(d => d.id).sort());
const byId = new Map(spec.documents.map(d => [d.id, d]));
const pageCounts = new Map();
for (const d of manifest.documents) {
  const selected = byId.get(d.id);
  const target = path.resolve(root, d.path);
  assert(target.startsWith(root + path.sep), d.id + ': outside project');
  const bytes = await fs.readFile(target);
  assert(bytes.subarray(0, 1024).includes(Buffer.from('%PDF-')), d.id + ': not PDF');
  assert.equal(bytes.length, d.bytes, d.id + ': size');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), d.sha256, d.id + ': hash');
  const info = execFileSync('pdfinfo', [target], {encoding:'utf8'});
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  assert.equal(pages, d.pages, d.id + ': page count');
  pageCounts.set(target, pages);
  const text = execFileSync('pdftotext', ['-layout', target, '-'], {encoding:'utf8', maxBuffer:20*1024*1024});
  assert(new RegExp(selected.expected_text, 'i').test(text), d.id + ': topic mismatch');
  assert.equal(d.reference_status, 'source_pdf_only_not_quote_verified');
  assert(!('landing_updated' in d) && !('landing_first_time_element' in d), d.id + ': ambiguous revision metadata');
  assert.equal(d.document_version, selected.document_version, d.id + ': stale version');
  if (selected.existing_path) assert.equal(d.fetched_at, null, d.id + ': reused file was not freshly fetched');
  else assert(d.fetched_at && d.download_url && d.resolved_url, d.id + ': missing acquisition provenance');
  for (const list of Object.values(d.text_heading_page_candidates)) {
    assert(list.every(p => Number.isInteger(p) && p >= 1 && p <= pages), d.id + ': invalid candidate page');
  }
}
const linkedPDFs = new Set();
let checkedLinks = 0;
for (const match of readme.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
  const href = match[1];
  if (/^https?:/.test(href)) continue;
  const [relative, fragment] = href.split('#');
  const target = path.resolve(base, decodeURIComponent(relative));
  assert(target.startsWith(root + path.sep), 'Link outside project: ' + href);
  await fs.access(target);
  checkedLinks++;
  if (target.endsWith('.pdf')) {
    linkedPDFs.add(target);
    if (fragment) {
      assert(/^page=\d+$/.test(fragment), 'Invalid PDF fragment: ' + href);
      const requested = Number(fragment.slice(5));
      assert(requested >= 1 && requested <= pageCounts.get(target), 'Page outside PDF: ' + href);
    }
  }
}
for (const d of manifest.documents) assert(linkedPDFs.has(path.resolve(root, d.path)), 'Unlinked source: ' + d.id);
const report = {
  check: 'offline_file_and_bibliography_integrity_only',
  documents: manifest.documents.length,
  new_pdfs: manifest.documents.filter(d => !d.existing_path).length,
  reused_pdfs: manifest.documents.filter(d => d.existing_path).length,
  pages: manifest.documents.reduce((n,d) => n+d.pages, 0),
  local_links_checked: checkedLinks,
  clinical_quote_verification: 'not_performed',
  website_hover_integration: 'not_performed',
  result: 'pass'
};
console.log(JSON.stringify(report, null, 2));
