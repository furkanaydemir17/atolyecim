import fs from 'fs';

const css = fs.readFileSync('C:\\Users\\FURKAN AYDEMİR\\.gemini\\antigravity\\scratch\\atolyecim\\style.css', 'utf8');

// Find index of first `@media`
const mediaIdx = css.indexOf('@media');
if (mediaIdx !== -1) {
  console.log(css.substring(mediaIdx, mediaIdx + 2000));
} else {
  console.log('No media query found');
}
