import { NextRequest, NextResponse } from 'next/server';
import { getGitClient, analyzeChurn, analyzeWorkload, analyzeCommitTypes, analyzeBusFactor, analyzeAutomation, analyzeKnowledgeDecay } from '@/lib/git-analyzer';
import { saveAnalysis } from '@/lib/db';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import os from 'os';

export async function POST(req: NextRequest) {
  let repoPathToGc: string | null = null;
  try {
    const { repo_path, branch } = await req.json();
    repoPathToGc = repo_path;

    if (!repo_path || !(await fsPromises.stat(repo_path).catch(() => null))) {
      return NextResponse.json({ error: 'Invalid or non-existent repository path.' }, { status: 400 });
    }

    const git = getGitClient(repo_path);

    // Verify it's a git repo
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return NextResponse.json({ error: 'Path is not a git repository.' }, { status: 400 });
    }

    // Fetch branches
    const branchSummary = await git.branch(['-a']);
    const availableBranches = Array.from(new Set(
      branchSummary.all
        .filter(b => b && !b.includes('HEAD'))
        .map(b => b.replace('remotes/origin/', '').replace('origin/', '').trim())
    ));
    const currentBranch = branchSummary.current || availableBranches[0] || 'main';
    
    // The branch string requested by the frontend
    const requestedBranch = branch || currentBranch;

    // Resolve a locally valid git ref (handles cloned repos where branches are remote-only)
    let targetBranch = requestedBranch;
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
    const activeFilesSet = new Set(activeFilesList);

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
      const originUrl = await git.remote(['get-url', 'origin']);
      if (originUrl && originUrl.trim()) {
        const parts = originUrl.trim().split('/');
        repoName = parts[parts.length - 1].replace('.git', '');
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
