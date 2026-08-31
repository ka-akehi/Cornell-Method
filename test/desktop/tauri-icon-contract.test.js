const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const iconPath = path.join(root, 'src-tauri/icons/icon.png');
const sourcePath = path.join(root, 'src-tauri/icons/icon.svg');
const configPath = path.join(root, 'src-tauri/tauri.conf.json');

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), colorType: buffer[25] };
}

test('Tauri bundle uses the Cornell icon assets', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.deepEqual(config.bundle.icon, ['icons/icon.png']);
  assert.ok(fs.existsSync(iconPath));
  assert.ok(!config.bundle.icon.some((entry) => entry.includes('vercel') || entry.includes('next')));
});

test('Cornell icon has a square RGBA PNG and no Vercel/Next source mark', () => {
  const png = pngDimensions(fs.readFileSync(iconPath));
  assert.equal(png.width, 1024);
  assert.equal(png.height, 1024);
  assert.equal(png.colorType, 6);

  const source = fs.readFileSync(sourcePath, 'utf8');
  assert.match(source, /#173F35/i);
  assert.match(source, /#F5E7CF/i);
  assert.match(source, /#C96A4A/i);
  assert.match(source, /#D7A84A/i);
  assert.doesNotMatch(source, /vercel|next\.js|triangle/i);
});
