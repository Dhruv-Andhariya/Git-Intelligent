const fs = require('fs');
const path = require('path');

const projectDir = 'c:\\Users\\Yash\\Desktop\\TechTitans\\gitlens-intelligence';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const replacements = [
  // Backgrounds
  { regex: /bg-\[#0a0a0a\]/g, replacement: 'bg-slate-50' },
  { regex: /bg-zinc-900\/50/g, replacement: 'bg-white shadow-sm' },
  { regex: /bg-black\/50/g, replacement: 'bg-white' },
  { regex: /bg-black\/40/g, replacement: 'bg-slate-100/90' },
  { regex: /bg-zinc-800/g, replacement: 'bg-slate-200' },
  // Accents mapping from Emerald to Blue (Professional)
  { regex: /emerald-(400|500|600)/g, replacement: 'blue-600' },
  { regex: /emerald/g, replacement: 'blue' },
  // Borders
  { regex: /border-white\/10/g, replacement: 'border-slate-200' },
  { regex: /border-white\/20/g, replacement: 'border-slate-300' },
  { regex: /border-white\/5/g, replacement: 'border-slate-100' },
  { regex: /border-zinc-700/g, replacement: 'border-slate-300' },
  // Text Colors
  { regex: /text-white/g, replacement: 'text-slate-900' },
  { regex: /text-zinc-200/g, replacement: 'text-slate-800' },
  { regex: /text-zinc-300/g, replacement: 'text-slate-700' },
  { regex: /text-zinc-400/g, replacement: 'text-slate-500' },
  { regex: /text-zinc-500/g, replacement: 'text-slate-400' },
  // Hover States
  { regex: /hover:bg-white\/10/g, replacement: 'hover:bg-slate-100' },
  { regex: /hover:bg-white\/5/g, replacement: 'hover:bg-slate-50' },
  { regex: /hover:text-zinc-200/g, replacement: 'hover:text-slate-800' },
  { regex: /hover:border-white\/20/g, replacement: 'hover:border-slate-300' },
  // Specific Recharts Inline styling
  { regex: /fill: '#a1a1aa'/g, replacement: "fill: '#475569'" },
  { regex: /fill: '#27272a'/g, replacement: "fill: '#e2e8f0'" },
  { regex: /backgroundColor: '#18181b'/g, replacement: "backgroundColor: '#ffffff'" },
  { regex: /border: '1px solid #3f3f46'/g, replacement: "border: '1px solid #cbd5e1'" },
  { regex: /color: '#e4e4e7'/g, replacement: "color: '#0f172a'" },
];

['app', 'components'].forEach(folder => {
  walkDir(path.join(projectDir, folder), (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      let originalContent = content;
      
      replacements.forEach(({ regex, replacement }) => {
        content = content.replace(regex, replacement);
      });
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
      }
    }
  });
});
