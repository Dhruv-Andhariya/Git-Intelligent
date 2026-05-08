import { NextRequest, NextResponse } from 'next/server';
import { simpleGit } from 'simple-git';
import os from 'os';
import path from 'path';
import { promises as fsPromises, existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function isGitAvailable(): Promise<boolean> {
  try {
    await execFileAsync('git', ['--version']);
    return true;
  } catch (e) {
    return false;
  }
}

async function isTarAvailable(): Promise<boolean> {
  try {
    await execFileAsync('tar', ['--version']);
    return true;
  } catch (e) {
    return false;
  }
}

function parseGitHubUrl(url: string): { owner: string; repo: string; branch: string } | null {
  try {
    const gitHubRegex = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/(.+))?$/i;
    const match = url.match(gitHubRegex);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        branch: match[3] || 'main'
      };
    }
  } catch (e) {
    // Invalid URL
  }
  return null;
}

async function cloneViaGitHubArchive(
  owner: string,
  repo: string,
  branch: string,
  targetPath: string
): Promise<void> {
  const archiveUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.tar.gz`;
  const tmpArchive = path.join(os.tmpdir(), `${repo}-${Date.now()}.tar.gz`);

  try {
    // Download the archive
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error(`Failed to download archive: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fsPromises.writeFile(tmpArchive, Buffer.from(buffer));

    // Create target directory
    await fsPromises.mkdir(targetPath, { recursive: true });

    // Extract archive: tar extracts to folder named {repo}-{branch}, so we extract to parent and then move contents
    const parentDir = path.dirname(targetPath);
    await execFileAsync('tar', ['-xzf', tmpArchive, '-C', parentDir]);

    // The archive extracts to a folder like 'repo-main', move its contents to targetPath
    const extractedDir = path.join(parentDir, `${repo}-${branch}`);
    if (existsSync(extractedDir) && extractedDir !== targetPath) {
      const files = await fsPromises.readdir(extractedDir);
      for (const file of files) {
        await fsPromises.rename(path.join(extractedDir, file), path.join(targetPath, file));
      }
      // Remove empty extracted directory
      try {
        await fsPromises.rmdir(extractedDir);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Clean up temporary archive
    try {
      await fsPromises.unlink(tmpArchive);
    } catch (e) {
      // Ignore cleanup errors
    }
  } catch (error) {
    // Clean up on failure
    try {
      await fsPromises.unlink(tmpArchive);
    } catch (e) {
      // Ignore
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || !url.startsWith('http')) {
      return new NextResponse('Valid GitHub URL required', { status: 400 });
    }

    const tmpDir = os.tmpdir();
    const repoHash = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    const targetPath = path.join(tmpDir, `gitlens-repo-${repoHash}`);

    // Check if it already exists
    if (existsSync(targetPath)) {
      try {
        const files = await fsPromises.readdir(targetPath);
        if (files.length > 0) {
          return NextResponse.json({ path: targetPath, cached: true });
        }
      } catch (e) {
        // Directory exists but is empty or inaccessible, proceed to clone
      }
    }

    // Try git clone first if available
    if (await isGitAvailable()) {
      try {
        const git = simpleGit();
        await git.clone(url, targetPath);
        return NextResponse.json({ path: targetPath, method: 'git' });
      } catch (gitError: any) {
        console.warn('Git clone failed, trying GitHub archive fallback:', gitError.message);
      }
    }

    // Fallback to GitHub archive if git is not available or failed
    const gitHubInfo = parseGitHubUrl(url);
    if (!gitHubInfo) {
      return new NextResponse(
        'GitHub URL required for archive fallback. Format: https://github.com/owner/repo',
        { status: 400 }
      );
    }

    // Check that tar is available for extraction
    if (!(await isTarAvailable())) {
      return new NextResponse(
        'Server does not have required tools (git or tar) to clone repositories.',
        { status: 503 }
      );
    }

    await cloneViaGitHubArchive(gitHubInfo.owner, gitHubInfo.repo, gitHubInfo.branch, targetPath);
    return NextResponse.json({ path: targetPath, method: 'github-archive' });
  } catch (error: any) {
    console.error('Cloning Error:', error);
    return new NextResponse(`Failed to clone repository: ${error.message}`, { status: 500 });
  }
}
