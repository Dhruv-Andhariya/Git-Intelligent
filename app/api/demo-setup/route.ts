import { NextRequest, NextResponse } from 'next/server';
import { simpleGit } from 'simple-git';
import { promises as fsPromises, existsSync } from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
  try {
    const demoPath = path.join(os.tmpdir(), 'gitlens-demo-repo');
    
    if (existsSync(demoPath)) {
      return NextResponse.json({ path: demoPath, message: 'Demo repo already exists' });
    }

    await fsPromises.mkdir(demoPath, { recursive: true });
    
    const git = simpleGit(demoPath);
    await git.init();

    // Create some files and commits
    const files = ['src/api/auth.js', 'src/db/migrations.js', 'src/utils/crypto.js', 'README.md', 'package.json'];
    
    // Create initial files in parallel
    await Promise.all(files.map(async (file) => {
      const filePath = path.join(demoPath, file);
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      await fsPromises.writeFile(filePath, `// Initial content for ${file}\n`);
    }));

    await git.add('.');
    await git.commit('Initial commit', { '--author': 'Alice Chen <alice@example.com>' });

    // Combine updates to minimize git add/commit calls for performance
    // Instead of doing one commit per iteration, let's do batches if possible, but the original code wanted to simulate history.
    // We can at least await file operations asynchronously properly.
    
    for (let i = 0; i < 5; i++) {
      await fsPromises.appendFile(path.join(demoPath, 'src/api/auth.js'), `// Update ${i}\n`);
      await git.add('.');
      await git.commit(`fix: update auth logic ${i}`, { '--author': 'Alice Chen <alice@example.com>' });
    }

    for (let i = 0; i < 4; i++) {
      await fsPromises.appendFile(path.join(demoPath, 'src/db/migrations.js'), `// Migration ${i}\n`);
      await git.add('.');
      await git.commit(`feat: add migration ${i}`, { '--author': 'Bob Martinez <bob@example.com>' });
    }

    for (let i = 0; i < 2; i++) {
      await fsPromises.appendFile(path.join(demoPath, 'src/utils/crypto.js'), `// Crypto ${i}\n`);
      await git.add('.');
      await git.commit(`chore: update crypto deps ${i}`, { '--author': 'Charlie Davis <charlie@example.com>' });
    }

    for (let i = 0; i < 2; i++) {
      await fsPromises.appendFile(path.join(demoPath, 'src/db/migrations.js'), `// Alice Migration ${i}\n`);
      await git.add('.');
      await git.commit(`fix: fix migration ${i}`, { '--author': 'Alice Chen <alice@example.com>' });
    }

    return NextResponse.json({ path: demoPath, message: 'Demo repo created successfully' });
  } catch (error: any) {
    console.error('Demo setup error:', error);
    return NextResponse.json({ error: 'Failed to setup demo repo' }, { status: 500 });
  }
}
