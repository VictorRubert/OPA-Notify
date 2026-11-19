// Roda todos os testes das regras de humor: `node tests/run-all.js`
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let falhou = false;
for (const arq of fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort()) {
  const saida = execFileSync(process.execPath, [path.join(__dirname, arq)], { encoding: 'utf8' });
  const placar = ((saida.match(/(\d+)\/(\d+)\s*$/m) || [])[0] || '?').trim();
  const [ok, total] = placar.split('/').map(Number);
  const passou = ok === total;
  if (!passou) falhou = true;
  console.log(`${passou ? '✔' : '✘'} ${arq.padEnd(26)} ${placar}`);
  if (!passou) console.log(saida.split('\n').filter((l) => l.includes('✘')).join('\n'));
}
process.exit(falhou ? 1 : 0);
