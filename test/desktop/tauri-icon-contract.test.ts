// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- PNG/config contract parsing is intentionally structural.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, '../..');
const iconPath = path.join(root, 'src-tauri/icons/icon@2x.png');
const sourcePath = path.join(root, 'src-tauri/icons/icon.svg');
const configPath = path.join(root, 'src-tauri/tauri.conf.json');

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), colorType: buffer[25] };
}

test('Tauri bundle uses the Cornell brand icon asset', () => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.deepEqual(config.bundle.icon, ['icons/icon@2x.png']);
  assert.ok(fs.existsSync(iconPath));
  assert.match(config.bundle.icon[0], /@2x\.png$/);
  assert.ok(!config.bundle.icon.some((entry) => entry.includes('vercel') || entry.includes('next')));
});

test('brand icon has a square RGBA PNG and a serif C source mark', () => {
  const png = pngDimensions(fs.readFileSync(iconPath));
  assert.equal(png.width, 1024);
  assert.equal(png.height, 1024);
  assert.equal(png.colorType, 6);

  const source = fs.readFileSync(sourcePath, 'utf8');
  assert.match(source, /#173F35/i);
  assert.match(source, /#F5E7CF/i);
  assert.match(source, /<rect\b[^>]*(?:fill="#173F35"[^>]*rx="|rx="[^>]*fill="#173F35")/i);
  assert.match(source, /<text\b[^>]*fill="#F5E7CF"[^>]*font-family="Georgia, Times New Roman, serif"[^>]*font-size="720"[^>]*font-weight="700"[^>]*>C<\/text>/i);
  assert.doesNotMatch(source, /<(?:line|polyline|polygon)\b/i);
  assert.doesNotMatch(source, /<path\b/i);
  assert.doesNotMatch(source, /paper|ruled|horizontal|vertical/i);
  assert.doesNotMatch(source, /vercel|next\.js|triangle/i);
});
