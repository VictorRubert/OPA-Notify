const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');
const inventory = require('../integrations/termostato-originals.json');

test('Termostato files match the original ZIP byte for byte', () => {
  function files(dir) {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
  }
  assert.deepEqual(files('termostato').sort(), Object.keys(inventory.sha256).sort());
  for (const [file, hash] of Object.entries(inventory.sha256)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), hash, file);
  }
});

test('Termostato modules keep original order with Notify adapter before bootstrap', () => {
  const manifest = require('../manifest.json');
  const original = require('../termostato/manifest.json');
  const entry = manifest.content_scripts.find(e => e.js.includes('termostato/src/main.js'));
  assert.deepEqual(entry.js.filter(p => p.startsWith('termostato/')), original.content_scripts[0].js.map(p => `termostato/${p}`));
  assert.equal(entry.js.at(-2), 'integrations/termostato.js');
  assert.deepEqual(entry.css, ['termostato/styles.css']);
  assert.equal(inventory.version, original.version);
  assert.equal(entry.world || 'ISOLATED', 'ISOLATED');
  for (const permission of original.permissions) assert(manifest.permissions.includes(permission));
});
