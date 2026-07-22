import fs from 'fs';

const css = fs.readFileSync('C:\\Users\\FURKAN AYDEMİR\\.gemini\\antigravity\\scratch\\atolyecim\\style.css', 'utf8');

// Find all occurrences of dashboard or page
const regex = /[^{}]*(?:page-dashboard|page|content)[^{}]*\{[^{}]*\}/gi;
let match;
while ((match = regex.exec(css)) !== null) {
  console.log('Match:', match[0].trim().replace(/\s+/g, ' '));
}
