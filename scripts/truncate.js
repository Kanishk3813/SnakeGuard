const fs = require('fs');
const filePath = 'src/app/path-test/page.tsx';
const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
const good = lines.slice(0, 617).join('\n') + '\n';
fs.writeFileSync(filePath, good, 'utf8');
console.log('Truncated to', good.split('\n').length, 'lines');
