import { NextRequest, NextResponse } from 'next/server';
import { simpleGit } from 'simple-git';
import os from 'os';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || !url.startsWith('http')) {
      return new NextResponse('Valid GitHub URL required', { status: 400 });
    }

    const tmpDir = os.tmpdir();
    const repoHash = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    const targetPath = path.join(tmpDir, `gitlens-repo-${repoHash}`);

    const git = simpleGit();
    
    // Check if it already exists, if so, return it directly
    try {
      const existingGit = simpleGit(targetPath);
      await existingGit.status();
      // It exists and is a git repo, no need to clone again
      return NextResponse.json({ path: targetPath });
    } catch (e) {
      // Doesn't exist, proceed to clone
    }

    // Clone with full depth as requested by extreme accuracy users
    await git.clone(url, targetPath);

    return NextResponse.json({ path: targetPath });
  } catch (error: any) {
    console.error("Cloning Error:", error);
    return new NextResponse(`Failed to clone repository: ${error.message}`, { status: 500 });
  }
}
