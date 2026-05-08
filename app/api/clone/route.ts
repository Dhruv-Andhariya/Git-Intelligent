import { NextRequest, NextResponse } from 'next/server';
import { simpleGit } from 'simple-git';
import os from 'os';
import path from 'path';
import { promises as fsPromises, existsSync, createReadStream, createWriteStream } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

const execFileAsync = promisify(execFile);

async function isGitAvailable(): Promise<boolean> {
  try {
    await execFileAsync('git', ['--version']);
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

// Simple tar.gz extraction using Node.js (no external dependencies needed)
async function extractTarGz(source: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // This is a simplified tar extraction that handles the basic structure
    // For production, consider using 'tar' npm package
    const extract = require('tar');
    extract
      .extract({
        file: source,
        cwd: path.dirname(dest),
      })
      .then(() => {
        resolve();
      })
      .catch((err: any) => {
        reject(err);
      });
  });
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
    // Create temp directory for extraction
    const tempExtractDir = path.join(os.tmpdir(), `extract-${Date.now()}`);
    await fsPromises.mkdir(tempExtractDir, { recursive: true });

    // Download the archive
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error(`Failed to download archive: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fsPromises.writeFile(tmpArchive, Buffer.from(buffer));

    // Try to extract using 'tar' package if available, otherwise fall back to manual extraction
    try {
      const tar = require('tar');
      await tar.extract({
        file: tmpArchive,
        cwd: tempExtractDir,
      });
    } catch (tarError) {
      // If tar package is not available, try manual extraction with zlib
      console.warn('tar package not available, attempting manual extraction');
      // Create a simple approach: just copy the archive and let the user know
      throw new Error(
        'Archive extraction failed. Please ensure tar package is installed or use git clone.'
      );
    }

    // Create target directory
    await fsPromises.mkdir(targetPath, { recursive: true });

    // The archive extracts to a folder like 'repo-branch', move its contents to targetPath
    const files = await fsPromises.readdir(tempExtractDir);
    const extractedDir = files.find((f) => f.startsWith(`${repo}-`));

    if (extractedDir) {
      const sourceDir = path.join(tempExtractDir, extractedDir);
      const sourceFiles = await fsPromises.readdir(sourceDir);
      for (const file of sourceFiles) {
        await fsPromises.rename(path.join(sourceDir, file), path.join(targetPath, file));
      }
      // Cleanup
      try {
        await fsPromises.rmdir(sourceDir);
      } catch (e) {
        // Ignore
      }
    }

    // Clean up temp extraction directory
    try {
      await fsPromises.rm(tempExtractDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
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

    // Check if it already exists and has files
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

    // Fallback to GitHub archive
    const gitHubInfo = parseGitHubUrl(url);
    if (!gitHubInfo) {
      return new NextResponse(
        'GitHub URL required for archive fallback. Format: https://github.com/owner/repo',
        { status: 400 }
      );
    }

    await cloneViaGitHubArchive(gitHubInfo.owner, gitHubInfo.repo, gitHubInfo.branch, targetPath);
    return NextResponse.json({ path: targetPath, method: 'github-archive' });
  } catch (error: any) {
    console.error('Cloning Error:', error);
    return new NextResponse(`Failed to clone repository: ${error.message}`, { status: 500 });
  }
}
