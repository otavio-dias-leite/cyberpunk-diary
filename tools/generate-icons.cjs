const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

const root = path.resolve(__dirname, '..');
const svg = path.join(root, 'web/assets/icon.svg');
const webAssets = path.join(root, 'web/assets');
const androidRes = path.join(root, 'android/app/src/main/res');

(async () => {
  const render = (size) => sharp(svg).resize(size, size).png().toBuffer();
  const master = await render(1024);
  fs.writeFileSync(path.join(webAssets, 'icon.png'), master);
  fs.writeFileSync(path.join(webAssets, 'icon-192.png'), await render(192));
  fs.writeFileSync(path.join(webAssets, 'icon-512.png'), await render(512));
  fs.writeFileSync(path.join(webAssets, 'icon.ico'), await pngToIco([await render(256)]));
  if (fs.existsSync(androidRes)) {
    const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
    for (const [density, size] of Object.entries(sizes)) {
      const dir = path.join(androidRes, 'mipmap-' + density);
      fs.mkdirSync(dir, { recursive: true });
      const png = await render(size);
      fs.writeFileSync(path.join(dir, 'ic_launcher.png'), png);
      fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), png);
    }
    // Remove generated adaptive placeholders so Android uses the same complete square artwork.
    for (const density of ['mipmap-anydpi-v26']) {
      const dir = path.join(androidRes, density);
      for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
        const file = path.join(dir, name);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
  }
  console.log('Unified Cyberpunk Diary leaf icons generated for web, Android and Windows.');
})().catch((error) => { console.error(error); process.exit(1); });
