import fs from 'fs';

const css = fs.readFileSync('C:\\Users\\FURKAN AYDEMİR\\.gemini\\antigravity\\scratch\\atolyecim\\style.css', 'utf8');

// Find all occurrences of #content
const regex = /[^{}]*#content[^{}]*\{[^{}]*\}/g;
let match;
while ((match = regex.exec(css)) !== null) {
  console.log('Match:', match[0]);
}

// Find if any other rule changes overflow-y or height on #content or main
const regex2 = /[^{}]*(?:main|content)[^{}]*\{[^{}]*\}/gi;
while ((match = regex2.exec(css)) !== null) {
  if (match[0].includes('overflow') || match[0].includes('height')) {
    console.log('Match main/content:', match[0]);
  }
}
