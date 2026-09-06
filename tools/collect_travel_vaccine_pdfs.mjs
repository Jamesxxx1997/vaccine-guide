#!/usr/bin/env node
// Download only reviewed public source URLs. Original PDFs are never rewritten.
// No TLS bypass, HTML-to-PDF conversion, or clinical recommendation generation.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {commitCompleteManifest, recordedFetchTime} from './archive_manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'sources/旅遊疫苗/2026-09-06');
const spec = JSON.parse(await fs.readFile(path.join(base, 'catalogue.json'), 'utf8'));
if (new Set(spec.documents.map(d => d.id)).size !== spec.documents.length) throw Error('Duplicate source IDs');
const manifestPath = path.join(base, 'manifest.json');
let previous = {};
try { previous = JSON.parse(await fs.readFile(manifestPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const old = new Map((previous.documents || []).map(d => [d.id, d]));
const allowed = ['who.int', 'cdc.gov', 'cdc.gov.tw', 'gov.uk', 'travelhealthpro.org.uk', 'fda.gov', 'ema.europa.eu', 'health.gov.au', 'tga.gov.au', 'moh.gov.sa', 'tainan.gov.tw', 'labeling.seqirus.com'];
function checkURL(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !allowed.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) throw Error('Unreviewed host: ' + url);
  return u.href;
}
async function get(url) {
  // Validate each redirect target before sending any request.
  for (let n = 0; n < 8; n++) {
    checkURL(url);
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25000) });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const next = new URL(r.headers.get('location'), url).href;
      await r.body?.cancel(); url = next; continue;
    }
    if (!r.ok) { await r.body?.cancel(); throw Error('HTTP ' + r.status + ': ' + url); }
    const data = Buffer.from(await r.arrayBuffer());
    if (data.length > 30 * 1024 * 1024) throw Error('Unexpectedly large source');
    return { data, url, type: r.headers.get('content-type'), lastModified: r.headers.get('last-modified') };
  }
  throw Error('Too many redirects');
}
async function collect(doc) {
  let download = doc.url, response;
  const target = doc.existing_path ? path.resolve(root, doc.existing_path) : path.join(base, doc.id + '.pdf');
  if (!target.startsWith(root + path.sep)) throw Error('Invalid target');
  let data;
  try { data = await fs.readFile(target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (!data) {
    if (doc.existing_path) throw Error('Existing source missing');
    if (!download) {
      response = await get(doc.landing_url);
      const html = response.data.toString('utf8');
      const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(m => new URL(m[1].replaceAll('&amp;', '&'), doc.landing_url).href);
      const candidates = [...new Set(links.filter(u => doc.pdf_pattern ? new RegExp(doc.pdf_pattern).test(u) : /\.pdf(?:$|\?)/i.test(u)))];
      if (candidates.length !== 1) throw Error('Ambiguous PDF links: ' + candidates.length);
      download = candidates[0];
    }
    response = await get(download);
    data = response.data;
    if (!data.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw Error('Not a PDF (refuse to archive HTML as PDF)');
    await fs.writeFile(target, data, { flag: 'wx' });
  }
  if (!data.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw Error('Cached file is not a PDF');
  const hash = createHash('sha256').update(data).digest('hex');
  if (old.has(doc.id) && old.get(doc.id).sha256 !== hash) throw Error('Archived source changed: ' + doc.id);
  const info = execFileSync('pdfinfo', [target], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!pages) throw Error('PDF has no readable pages');
  const text = execFileSync('pdftotext', ['-layout', target, '-'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const textPages = text.split('\f');
  if (!new RegExp(doc.expected_text, 'i').test(text)) throw Error('PDF title/topic mismatch');
  const headingPatterns = {
    schedule: /dosage|posology|schedule|接種時程|劑次/i,
    contraindications: /contraindications|接種禁忌|禁忌症/i,
    precautions: /precautions|special warnings|注意事項|警語/i,
    travel: /travell?er|travell?ing|旅遊|旅客/i
  };
  const sections = Object.fromEntries(Object.entries(headingPatterns).map(([key, re]) => [key,
    textPages.flatMap((t, i) => re.test(t) && i < pages ? [i + 1] : [])]));
  // Page timestamps (including the first <time>) are not document revisions.
  // Drop obsolete inferred fields when migrating earlier manifests.
  const { landing_updated, landing_first_time_element, ...previousDoc } = old.get(doc.id) || {};
  return { ...previousDoc, ...doc, path: path.relative(root, target),
    download_url: download || old.get(doc.id)?.download_url || null,
    resolved_url: response?.url || old.get(doc.id)?.resolved_url || download || null,
    fetched_at: recordedFetchTime(old.get(doc.id), Boolean(doc.existing_path), Boolean(response), new Date().toISOString()),
    inspected_at: new Date().toISOString(),
    content_type: response?.type || old.get(doc.id)?.content_type || null,
    last_modified_header: response?.lastModified || old.get(doc.id)?.last_modified_header || null,
    bytes: data.length, sha256: hash, pages, text_characters: text.length,
    text_heading_page_candidates: sections, reference_status: 'source_pdf_only_not_quote_verified',
    validation: 'pdf_signature_pdfinfo_text_topic_pass' };
}
const results = [], failures = [];
for (let i = 0; i < spec.documents.length; i += 3) {
  await Promise.all(spec.documents.slice(i, i + 3).map(async doc => {
    try { const r = await collect(doc); results.push(r); console.log('OK', doc.id, r.pages, 'pages'); }
    catch (e) { failures.push({ id: doc.id, error: e.message }); console.log('FAIL', doc.id, e.message); }
  }));
}
console.log(JSON.stringify({ documents: results.length, pages: results.reduce((s,d) => s + d.pages, 0), failures }));
if (failures.length) {
  console.error('Collection incomplete. Previous manifest is preserved; failures above are NOT accepted into the archive baseline.');
  process.exitCode = 1;
} else {
  results.sort((a,b) => a.id.localeCompare(b.id));
  await commitCompleteManifest(manifestPath, {schema_version: 1, collected_on: spec.collected_on,
    note: 'PDF archive only; page candidates are text-heading matches, NOT verified quotation coordinates. No clinical rules or website UI changed.',
    documents: results, failures: []});
}
