import fs from 'fs';

const contactsJs = fs.readFileSync('C:\\Users\\FURKAN AYDEMİR\\.gemini\\antigravity\\scratch\\atolyecim\\contacts.js', 'utf8');

// Find all functions or keys related to detail, modal, or history
const regex = /[a-zA-Z0-9_]+\s*\([^)]*\)\s*\{[^}]*\}/g;
let match;
console.log('--- Functions in contacts.js ---');
// Let's just print lines containing "detail" or "modal"
const lines = contactsJs.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('detail') || line.includes('modal') || line.includes('history') || line.includes('show') || line.includes('view')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
