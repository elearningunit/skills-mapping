// ממיר את dist/index.html לגרסת Artifact של claude.ai (ללא שלד doctype/html/head/body).
// שימו לב: הקוד המוטמע מכיל בעצמו מחרוזות כמו "</head>" ו-"<body>", ולכן מחפשים את המופע האחרון של כל תגית.
import { readFileSync, writeFileSync } from 'node:fs';
const [input = 'dist-artifact/index.html', output = 'dist/artifact.html'] = process.argv.slice(2);
const html = readFileSync(input, 'utf8');
const headStart = html.indexOf('<head>') + '<head>'.length;
const bodyOpen = html.lastIndexOf('<body>');
const headEnd = html.lastIndexOf('</head>', bodyOpen);
const bodyEnd = html.lastIndexOf('</body>');
let head = html.slice(headStart, headEnd);
const body = html.slice(bodyOpen + '<body>'.length, bodyEnd).trim();
if (!body.includes('id="root"')) throw new Error('root element not found');
const title = head.match(/^[\s\S]*?(<title>[\s\S]*?<\/title>)/)[1];
head = head
  .replace(title, '')
  .replace(/<meta charset="UTF-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const out = `${title}\n${body}\n${head.trim()}\n`;
writeFileSync(output, out);
console.log(output, (Buffer.byteLength(out) / 1024).toFixed(0) + 'KB');
