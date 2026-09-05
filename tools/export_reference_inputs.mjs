// Read only the site's source registry. Never evaluate browser/UI code.
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = html.match(/const SRC = (\{[\s\S]*?\n\});/);
if (!source) throw new Error('Source registry missing');
console.log(JSON.stringify(Function(`return (${source[1]})`)()));
