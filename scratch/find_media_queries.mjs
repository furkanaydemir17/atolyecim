import fs from 'fs';

const css = fs.readFileSync('C:\\Users\\FURKAN AYDEMİR\\.gemini\\antigravity\\scratch\\atolyecim\\style.css', 'utf8');

// Find all media queries and display rules inside them for #app, #content, body, or html
const regex = /@media[^{]*\{([\s\S]*?)\n\}/g;
let match;
while ((match = regex.exec(css)) !== null) {
  const content = match[1];
  if (content.includes('#app') || content.includes('#content') || content.includes('body')) {
    console.log('Media Query Block:', match[0].substring(0, 100) + '...');
    // print lines that match #app or #content or body
    const lines = content.split('\n');
    lines.forEach(l => {
      if (l.includes('#app') || l.includes('#content') || l.includes('body') || l.includes('height') || l.includes('overflow')) {
        console.log('  ', l.trim());
      }
    });
  }
}
