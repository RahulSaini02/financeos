const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, '../public/icon-192.png');
const dest = path.join(__dirname, '../public/icon-512.png');

sharp(src)
  .resize(512, 512, { kernel: sharp.kernel.lanczos3, fit: 'fill' })
  .png()
  .toFile(dest)
  .then(() => console.log('icon-512.png written (512x512)'))
  .catch((err) => { console.error(err); process.exit(1); });
