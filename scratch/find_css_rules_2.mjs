import fs from 'fs';

const css = fs.readFileSync('C:\\Users\\FURKAN AYDEMİR\\.gemini\\antigravity\\scratch\\atolyecim\\style.css', 'utf8');

// Find all occurrences of height: 100% or overflow: hidden or similar on elements
const matches = css.match(/[^{}]*\{[^{}]*height:[^}]*\}/gi);
if (matches) {
  matches.forEach(m => {
    if (m.includes('page') || m.includes('content') || m.includes('app') || m.includes('body') || m.includes('html')) {
      console.log('Height rule:', m.trim().replace(/\s+/g, ' '));
    }
  });
}

const overflowMatches = css.match(/[^{}]*\{[^{}]*overflow:[^}]*\}/gi);
if (overflowMatches) {
  overflowMatches.forEach(m => {
    console.log('Overflow rule:', m.trim().replace(/\s+/g, ' '));
  });
}
