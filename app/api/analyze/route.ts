import { NextRequest, NextResponse } from 'next/server';
import { getGitClient, analyzeChurn, analyzeWorkload, analyzeCommitTypes, analyzeBusFactor, analyzeAutomation, analyzeKnowledgeDecay } from '@/lib/git-analyzer';
import { saveAnalysis } from '@/lib/db';
import { promises as fsPromises } from 'fs';
import * as fs from 'fs';
import path from 'path';
import os from 'os';

// Helper to recursively list files in a directory
async function walkDirectory(dir: string, baseDir: string = dir, depth: number = 0, maxDepth: number = 10): Promise<string[]> {
  const files: string[] = [];
  if (depth > maxDepth) return files; // Prevent deep recursion

  try {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip node_modules, .git, .next, etc.
      if (['.git', 'node_modules', '.next', '.vercel', 'dist', 'build', '.env', '.env.local', '.github', '.gitignore'].includes(entry.name)) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      try {
        if (entry.isDirectory()) {
          files.push(...await walkDirectory(fullPath, baseDir, depth + 1, maxDepth));
        } else {
          files.push(relativePath);
        }
      } catch (e) {
        // Skip entries that can't be read
        console.warn(`Failed to process ${fullPath}:`, e);
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
    console.log('[analyze] Request received for repo:', repo_path, 'branch:', branch);
    repoPathToGc = repo_path;

    if (!repo_path) {
      console.error('[analyze] No repo_path provided');
      return NextResponse.json({ error: 'repo_path is required' }, { status: 400 });
    }

    // Check if path exists
    try {
      const stat = await fsPromises.stat(repo_path);
      console.log('[analyze] Repo path exists, isDirectory:', stat.isDirectory());
    } catch (e) {
      console.error('[analyze] Repo path does not exist:', repo_path, e);
      return NextResponse.json({ error: 'Invalid or non-existent repository path.' }, { status: 400 });
    }

    const git = getGitClient(repo_path);
    console.log('[analyze] Git client created');
    const hasGitDir = fs.existsSync(path.join(repo_path, '.git'));
    console.log('[analyze] Has .git directory:', hasGitDir);

    let availableBranches: string[] = [];
    let currentBranch = 'main';
    let targetBranch = 'main';
    let requestedBranch = branch || 'main';
    let activeFilesSet = new Set<string>();

    // Only perform git operations if .git directory exists
    if (hasGitDir) {
      console.log('[analyze] Detecting git repo...');
      // Verify it's a git repo
      const isRepo = await git.checkIsRepo().catch(() => false);
      console.log('[analyze] Is git repo:', isRepo);
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
      console.log('[analyze] Available branches:', availableBranches, 'current:', currentBranch);

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
         try {
           lsTreeRaw = await git.raw(['ls-tree', '-r', 'HEAD', '--name-only']);
         } catch (e2) {
           console.warn('Failed to get file tree from git:', e2);
           lsTreeRaw = '';
         }
      }
      const activeFilesList = lsTreeRaw.split('\n').map(f => f.trim()).filter(Boolean);
      activeFilesSet = new Set(activeFilesList);
    } else {
      // For archive-extracted repos without .git, list files from the filesystem
      console.log('[analyze] No .git directory, using filesystem walk for files...');
      try {
        const filesList = await walkDirectory(repo_path);
        activeFilesSet = new Set(filesList);
        console.log(`[analyze] Found ${filesList.length} files from archive-extracted repo`);
      } catch (e) {
        console.error('[analyze] Failed to list files from archive-extracted repo:', e);
        activeFilesSet = new Set();
      }
    }

    // Run analyzers in parallel with error handling
    let churn: any = { labels: [], data: [] };
    let workload: any = { devs: [], counts: [], topContributor: null, totalCommits: 0 };
    let commitTypes: any = { feat: 0, fix: 0, refactor: 0, chore: 0, other: 0 };
    let busFactor: any = { score: 10, flaggedFiles: [] };
    let knowledgeDecay: any = { healthScore: 0, files: [] };
    let automation: any = { hasCI: false, hasCoverage: false, automationScore: 0 };

    try {
      const results = await Promise.allSettled([
        analyzeChurn(repo_path, activeFilesSet, targetBranch),
        analyzeWorkload(repo_path, targetBranch),
        analyzeCommitTypes(repo_path, targetBranch),
        analyzeBusFactor(repo_path, activeFilesSet, undefined, targetBranch),
        analyzeKnowledgeDecay(repo_path, activeFilesSet, targetBranch)
      ]);
      
      if (results[0].status === 'fulfilled') churn = results[0].value;
      if (results[1].status === 'fulfilled') workload = results[1].value;
      if (results[2].status === 'fulfilled') commitTypes = results[2].value;
      if (results[3].status === 'fulfilled') busFactor = results[3].value;
      if (results[4].status === 'fulfilled') knowledgeDecay = results[4].value;
      
      automation = await analyzeAutomation(repo_path, churn, busFactor).catch((e) => {
        console.error('[analyze] Automation analysis error:', e);
        return { hasCI: false, hasCoverage: false, automationScore: 0 };
      });
    } catch (analyzerError: any) {
      console.error('[analyze] Analyzer error:', analyzerError);
      // Continue with empty defaults
    }
    console.log('[analyze] Analysis complete. Results:', { churn: !!churn, workload: !!workload, commitTypes: !!commitTypes, busFactor: !!busFactor, knowledgeDecay: !!knowledgeDecay, automation: !!automation });

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
    try {
      saveAnalysis(repo_path, result);
      console.log('[analyze] Results saved to database');
    } catch (e) {
      console.error('[analyze] Failed to save results to database:', e);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[analyze] FATAL Analysis error:', error);
    console.error('[analyze] Error stack:', error?.stack);
    return NextResponse.json({ error: 'Failed to analyze repository', details: error?.message || 'Unknown error' }, { status: 500 });
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
