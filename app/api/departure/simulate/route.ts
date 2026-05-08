import { NextRequest, NextResponse } from 'next/server';
import { getGitClient, analyzeBusFactor } from '@/lib/git-analyzer';
import { getHistory } from '@/lib/db';
import { analyzeArchiveRepoOnDisk, simulateDepartureFromOwnership } from '@/lib/github-archive-analyzer';
import { promises as fsPromises } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { repo_path, developer } = await req.json();

    if (!repo_path || !(await fsPromises.stat(repo_path).catch(() => null))) {
      return NextResponse.json({ error: 'Invalid or non-existent repository path.' }, { status: 400 });
    }

    if (!developer) {
      return NextResponse.json({ error: 'Developer name is required.' }, { status: 400 });
    }

    // Get original analysis
    const history = getHistory(repo_path, 1);
    const snapshot = history[0]?.snapshot || await analyzeArchiveRepoOnDisk(repo_path);
    if (!snapshot) {
      return NextResponse.json({ error: 'Please run a full analysis first.' }, { status: 400 });
    }
    const originalBusFactor = snapshot.busFactor;
    const busFactorDetails = snapshot.busFactorDetails;

    if (busFactorDetails?.fileAuthors) {
      const archiveDeparture = simulateDepartureFromOwnership(busFactorDetails, developer);
      const result = {
        before: { score: originalBusFactor.score, flaggedFiles: originalBusFactor.flaggedFiles.length },
        after: archiveDeparture.after,
        orphanedFiles: archiveDeparture.orphanedFiles,
        developer
      };

      return NextResponse.json(result);
    }

    const git = getGitClient(repo_path);
    
    // Run bus factor excluding the developer
    const lsTreeRaw = await git.raw(['ls-tree', '-r', 'HEAD', '--name-only']);
    const activeFilesSet = new Set(lsTreeRaw.split('\n').map(f => f.trim()).filter(Boolean));
    const newBusFactor = await analyzeBusFactor(repo_path, activeFilesSet, developer);

    // Identify orphaned files (files where the developer was the owner in the original analysis)
    const orphanedFiles = originalBusFactor.flaggedFiles
      .filter((f: any) => f.owner === developer && f.pct > 80)
      .map((f: any) => f.file);

    const result = {
      before: { score: originalBusFactor.score, flaggedFiles: originalBusFactor.flaggedFiles.length },
      after: { score: newBusFactor.score, flaggedFiles: newBusFactor.flaggedFiles.length },
      orphanedFiles,
      developer
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Departure simulation error:', error);
    return NextResponse.json({ error: 'Failed to simulate departure' }, { status: 500 });
  }
}
