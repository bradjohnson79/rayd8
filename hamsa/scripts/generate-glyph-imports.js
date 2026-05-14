const fs = require('fs');
const path = require('path');

const GLYPHS_DIR = path.join(__dirname, '../assets/appImages/glyphs');
const OUTPUT_FILE = path.join(GLYPHS_DIR, 'index.ts');

const folders = ['energy_glyphs', 'physical_glyphs', 'full_glyphs'];
const exportsMap = {
  energy_glyphs: 'ENERGY_GLYPHS',
  physical_glyphs: 'PHYSICAL_GLYPHS',
  full_glyphs: 'FULL_GLYPHS',
};

let fileContent = '';

folders.forEach(folder => {
  const folderPath = path.join(GLYPHS_DIR, folder);
  if (fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.png'));
    
    fileContent += `export const ${exportsMap[folder]} = [\n`;
    files.forEach(file => {
      fileContent += `  require('./${folder}/${file}'),\n`;
    });
    fileContent += `];\n\n`;
  }
});

fs.writeFileSync(OUTPUT_FILE, fileContent);
console.log(`Generated ${OUTPUT_FILE}`);
