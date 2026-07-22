import fs from 'fs';

const html = fs.readFileSync('C:\\Users\\FURKAN AYDEMİR\\.gemini\\antigravity\\scratch\\atolyecim\\index.html', 'utf8');

// Find closing </main>
const mainIdx = html.indexOf('</main>');
if (mainIdx !== -1) {
  // Print 20 lines before </main>
  const before = html.substring(0, mainIdx);
  const lines = before.split('\n');
  console.log(lines.slice(-20).join('\n'));
  console.log('</main> is at line:', lines.length + 1);
} else {
  console.log('No </main> found');
}
