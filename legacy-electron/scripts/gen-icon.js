const fs = require('fs');
const path = require('path');

(async () => {
  const pngToIco = (await import('png-to-ico')).default;
  const root = path.join(__dirname, '..');
  const png = path.join(root, 'icon.png');
  const ico = path.join(root, 'icon.ico');
  if (!fs.existsSync(png)) {
    console.error('icon.png not found');
    process.exit(1);
  }
  fs.writeFileSync(ico, await pngToIco(png));
  console.log('Created', ico);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
