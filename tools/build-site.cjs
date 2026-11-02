const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicFiles = ['index.html', 'admin.html', 'NewDrop.html', '404.html', 'config.js', 'robots.txt', 'sitemap.xml'];
const publicDirectories = ['assets', 'img'];

function buildSite(destination) {
  const output = path.resolve(destination);
  if (fs.existsSync(output)) throw new Error('La carpeta de salida debe ser nueva.');
  fs.mkdirSync(output, { recursive: true });
  for (const file of publicFiles) fs.copyFileSync(path.join(root, file), path.join(output, file));
  for (const directory of publicDirectories) fs.cpSync(path.join(root, directory), path.join(output, directory), { recursive: true });
  return output;
}

if (require.main === module) {
  const output = path.join(root, 'dist');
  // Limpiar solo la salida exacta de este proyecto, sin seguir enlaces/junctions.
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Ruta de salida inválida.');
  if (fs.existsSync(output)) {
    if (fs.lstatSync(output).isSymbolicLink() || fs.realpathSync(output) !== output) throw new Error('La salida no puede ser un enlace.');
    fs.rmSync(output, { recursive: true, force: true });
  }
  buildSite(output);
  console.log('Sitio público preparado en dist/: HTML, configuración pública, assets e imágenes.');
}

module.exports = { buildSite };
