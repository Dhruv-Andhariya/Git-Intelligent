import { execSync } from 'child_process';
const repoPath = process.cwd();

try {
  const lsTreeRaw = execSync('git ls-tree -r HEAD --name-only', { encoding: 'utf-8', cwd: repoPath });
  const activeFilesSet = new Set(lsTreeRaw.split('\n').map(f => f.trim()).filter(Boolean));
  console.log('Total files in activeFilesSet:', activeFilesSet.size);
  console.log('Sample files in set:', Array.from(activeFilesSet).slice(0, 3));

  const logRaw = execSync('git log -n 1 --name-only --pretty=format:', { encoding: 'utf-8', cwd: repoPath });
  const logFiles = logRaw.split('\n').map(f => f.trim()).filter(Boolean);
  console.log('\nFiles from git log:');
  for (const f of logFiles) {
    console.log(`- ${f} (In set? ${activeFilesSet.has(f)})`);
  }
} catch (e) {
  console.error(e.message);
}
