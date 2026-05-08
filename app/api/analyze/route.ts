import { NextRequest, NextResponse } from 'next/server';
import { getGitClient, analyzeChurn, analyzeWorkload, analyzeCommitTypes, analyzeBusFactor, analyzeAutomation, analyzeKnowledgeDecay } from '@/lib/git-analyzer';
import { saveAnalysis } from '@/lib/db';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import path from 'path';
import os from 'os';

// Helper to recursively list files in a directory
async function walkDirectory(dir: string, baseDir: string = dir): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip node_modules, .git, .next, etc.
      if (['.git', 'node_modules', '.next', '.vercel', 'dist', 'build', '.env', '.env.local'].includes(entry.name)) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      if (entry.isDirectory()) {
        files.push(...await walkDirectory(fullPath, baseDir));
      } else {
        files.push(relativePath);
      }
    }
  } catch (e) {
    console.warn(`Failed to read directory ${dir}:`, e);
  }
  return files;
}

export async function POST(req: NextRequest) {
  let repoPathToGc: string | null = null;
  try {
    const { repo_path, branch } = await req.json();
    repoPathToGc = repo_path;

    if (!repo_path || !(await fsPromises.stat(repo_path).catch(() => null))) {
      return NextResponse.json({ error: 'Invalid or non-existent repository path.' }, { status: 400 });
    }

    const git = getGitClient(repo_path);
    const hasGitDir = fs.existsSync(path.join(repo_path, '.git'));

    let availableBranches: string[] = [];
    let currentBranch = 'main';
    let targetBranch = 'main';
    let requestedBranch = branch || 'main';
    let activeFilesSet = new Set<string>();

    // Only perform git operations if .git directory exists
    if (hasGitDir) {
      // Verify it's a git repo
      const isRepo = await git.checkIsRepo().catch(() => false);
      if (!isRepo) {
        return NextResponse.json({ error: 'Path is not a git repository.' }, { status: 400 });
      }

      // Fetch branches
      const branchSummary = await git.branch(['-a']);
      availableBranches = Array.from(new Set(
        branchSummary.all
          .filter(b => b && !b.includes('HEAD'))
          .map(b => b.replace('remotes/origin/', '').replace('origin/', '').trim())
      ));
      currentBranch = branchSummary.current || availableBranches[0] || 'main';
      requestedBranch = branch || currentBranch;

      // Resolve a locally valid git ref (handles cloned repos where branches are remote-only)
      targetBranch = requestedBranch;
      const allRefs = branchSummary.all.map(b => b.trim());
      if (!allRefs.includes(requestedBranch)) {
        if (allRefs.includes(`remotes/origin/${requestedBranch}`)) {
          targetBranch = `remotes/origin/${requestedBranch}`;
        } else if (allRefs.includes(`origin/${requestedBranch}`)) {
          targetBranch = `origin/${requestedBranch}`;
        }
      }

      // Cache the active file tree
      let lsTreeRaw = '';
      try {
         lsTreeRaw = await git.raw(['ls-tree', '-r', targetBranch, '--name-only']);
      } catch(e) {
         lsTreeRaw = await git.raw(['ls-tree', '-r', 'HEAD', '--name-only']);
      }
      const activeFilesList = lsTreeRaw.split('\n').map(f => f.trim()).filter(Boolean);
      activeFilesSet = new Set(activeFilesList);
    } else {
      // For archive-extracted repos without .git, list files from the filesystem
      try {
        const filesList = await walkDirectory(repo_path);
        activeFilesSet = new Set(filesList);
      } catch (e) {
        console.warn('Failed to list files from archive-extracted repo:', e);
        activeFilesSet = new Set();
      }
    }

    // Run analyzers in parallel
    const [churn, workload, commitTypes, busFactor, knowledgeDecay] = await Promise.all([
      analyzeChurn(repo_path, activeFilesSet, targetBranch),
      analyzeWorkload(repo_path, targetBranch),
      analyzeCommitTypes(repo_path, targetBranch),
      analyzeBusFactor(repo_path, activeFilesSet, undefined, targetBranch),
      analyzeKnowledgeDecay(repo_path, activeFilesSet, targetBranch)
    ]);
    const automation = await analyzeAutomation(repo_path, churn, busFactor);

    let repoName = 'repository';
    try {
      if (hasGitDir) {
        const originUrl = await git.remote(['get-url', 'origin']).catch(() => '');
        if (originUrl && originUrl.trim()) {
          const parts = originUrl.trim().split('/');
          repoName = parts[parts.length - 1].replace('.git', '');
        } else {
          repoName = require('path').basename(repo_path);
        }
      } else {
        repoName = require('path').basename(repo_path);
      }
    } catch {
      repoName = require('path').basename(repo_path);
    }
    
    // Fallback if gitlens-repo
    if (repoName.startsWith('gitlens-repo-')) {
       repoName = 'Cloned Repository';
    }

    const result = {
      repoName,
      currentBranch: requestedBranch,
      availableBranches,
      analyzedAt: new Date().toISOString(),
      churn,
      busFactor,
      workload,
      commitTypes,
      automation,
      knowledgeDecay
    };

    // Save to SQLite
    saveAnalysis(repo_path, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze repository' }, { status: 500 });
  } finally {
    // Phase 4: Garbage Collection
    // Disabled here because the repository MUST persist on disk 
    // for subsequent dashboard features (Branch Switching, Departure Sim) to function.
    /*
    if (repoPathToGc && repoPathToGc.includes(os.tmpdir())) {
      try {
        fs.rmSync(repoPathToGc, { recursive: true, force: true });
        console.log(`[GARBAGE COLLECTION] Cleaned up temp repository: ${repoPathToGc}`);
      } catch (gcError) {
        console.error('Garbage collection failed:', gcError);
      }
    }
    */
  }
}
