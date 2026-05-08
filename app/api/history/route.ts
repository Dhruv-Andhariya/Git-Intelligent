import { NextRequest, NextResponse } from 'next/server';
import { getHistory } from '@/lib/db';
import { analyzeArchiveRepoOnDisk } from '@/lib/github-archive-analyzer';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const repo_path = searchParams.get('repo_path');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!repo_path) {
    return NextResponse.json({ error: 'Missing repo_path' }, { status: 400 });
  }

  try {
    const history = getHistory(repo_path, limit);
    if (history.length > 0) {
      // Reverse to return in chronological order (oldest first) for charting
      return NextResponse.json(history.reverse());
    }

    const snapshot = await analyzeArchiveRepoOnDisk(repo_path);
    if (snapshot) {
      return NextResponse.json([
        {
          id: 1,
          repo_path,
          created_at: new Date().toISOString(),
          snapshot,
        }
      ]);
    }

    return NextResponse.json([]);
  } catch (error: any) {
    console.error('History fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
