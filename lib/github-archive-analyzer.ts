import fs from 'fs';
import path from 'path';

export type RepoSourceInfo = {
  owner: string;
  repo: string;
  branch: string;
  sourceUrl?: string;
  method?: string;
};

type BusFactorDetails = {
  fileAuthors: Record<string, Record<string, number>>;
  authors: string[];
};

type CommitRecord = {
  sha: string;
  author: string;
  date: string;
  message: string;
  files: Array<{
    filename: string;
    additions: number;
    deletions: number;
  }>;
};

const GITHUB_API_BASE = 'https://api.github.com';

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchGitHubJson(url: string): Promise<any> {
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GitHub API error (${response.status}): ${text || response.statusText}`);
  }
  return response.json();
}

function normalizeFilePath(filePath: string) {
  return filePath.replace(/^\.\//, '').replace(/^[\\/]+/, '');
}

async function walkDirectory(dir: string, baseDir: string = dir, depth: number = 0, maxDepth: number = 10): Promise<string[]> {
  const files: string[] = [];
  if (depth > maxDepth) return files;

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['.git', 'node_modules', '.next', '.vercel', 'dist', 'build', '.env', '.env.local', '.github', '.gitignore', '.gitlens-meta.json'].includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        files.push(...await walkDirectory(fullPath, baseDir, depth + 1, maxDepth));
      } else {
        files.push(relativePath);
      }
    }
  } catch {
    // Ignore unreadable paths.
  }

  return files;
}

export async function readRepoSourceInfo(repoPath: string): Promise<RepoSourceInfo | null> {
  try {
    const metaPath = path.join(repoPath, '.gitlens-meta.json');
    if (!fs.existsSync(metaPath)) return null;
    const raw = await fs.promises.readFile(metaPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed?.owner || !parsed?.repo) return null;
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: parsed.branch || 'main',
      sourceUrl: parsed.sourceUrl,
      method: parsed.method,
    };
  } catch {
    return null;
  }
}

async function fetchCommitSummaries(owner: string, repo: string, branch: string, maxCommits = 150): Promise<CommitRecord[]> {
  const commits: CommitRecord[] = [];

  for (let page = 1; page <= 3 && commits.length < maxCommits; page++) {
    const listUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=100&page=${page}`;
    const pageCommits = await fetchGitHubJson(listUrl);
    if (!Array.isArray(pageCommits) || pageCommits.length === 0) break;

    for (const item of pageCommits) {
      commits.push({
        sha: item.sha,
        author: item?.commit?.author?.name || item?.commit?.committer?.name || 'Unknown',
        date: item?.commit?.author?.date || item?.commit?.committer?.date || new Date().toISOString(),
        message: item?.commit?.message || '',
        files: [],
      });

      if (commits.length >= maxCommits) break;
    }

    if (pageCommits.length < 100) break;
  }

  const batchSize = 8;
  for (let index = 0; index < commits.length; index += batchSize) {
    const batch = commits.slice(index, index + batchSize);
    const details = await Promise.all(
      batch.map(async (commit) => {
        const detail = await fetchGitHubJson(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${commit.sha}`);
        return {
          sha: commit.sha,
          author: detail?.commit?.author?.name || detail?.commit?.committer?.name || commit.author,
          date: detail?.commit?.author?.date || detail?.commit?.committer?.date || commit.date,
          message: detail?.commit?.message || commit.message,
          files: Array.isArray(detail?.files)
            ? detail.files.map((file: any) => ({
                filename: normalizeFilePath(file?.filename || ''),
                additions: Number(file?.additions || 0),
                deletions: Number(file?.deletions || 0),
              }))
            : [],
        };
      })
    );

    details.forEach((detail, offset) => {
      commits[index + offset] = detail;
    });
  }

  return commits;
}

function classifyCommitType(message: string) {
  const lower = message.trim().toLowerCase();
  if (!lower) return 'other';
  if (lower.match(/^(fix|bug|hotfix|patch|revert)\b/)) return 'fix';
  if (lower.match(/^(feat|add|new|implement|create)\b/)) return 'feat';
  if (lower.match(/^(refactor|clean|restructure|rename)\b/)) return 'refactor';
  if (lower.match(/^(chore|update|bump|upgrade|deps)\b/)) return 'chore';
  return 'other';
}

function computeBusFactorFromOwnership(fileAuthors: Record<string, Record<string, number>>, excludeDeveloper?: string) {
  const allAuthors = new Set<string>();
  for (const authors of Object.values(fileAuthors)) {
    for (const author of Object.keys(authors)) {
      if (!excludeDeveloper || author !== excludeDeveloper) {
        allAuthors.add(author);
      }
    }
  }

  const flaggedFiles: Array<{ file: string; owner: string; pct: number; commits: number }> = [];
  let singleOwnerFilesCount = 0;
  let totalFilesCount = 0;

  for (const [file, authorCounts] of Object.entries(fileAuthors)) {
    totalFilesCount++;
    let totalCommits = 0;
    let fileRawTotal = 0;

    for (const count of Object.values(authorCounts)) {
      fileRawTotal += count;
    }

    const osmosisBonus = fileRawTotal * 0.05;
    let topAuthor = '';
    let topAuthorCommits = 0;

    for (const author of allAuthors) {
      const count = (authorCounts[author] || 0) + osmosisBonus;
      totalCommits += count;
      if (count > topAuthorCommits) {
        topAuthorCommits = count;
        topAuthor = author;
      }
    }

    if (totalCommits > 0) {
      const pct = Math.round((topAuthorCommits / totalCommits) * 100);
      if (pct > 60) {
        singleOwnerFilesCount++;
        flaggedFiles.push({
          file,
          owner: topAuthor,
          pct,
          commits: Math.round(totalCommits),
        });
      }
    }
  }

  flaggedFiles.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    return b.commits - a.commits;
  });

  const concentrationRatio = totalFilesCount > 0 ? singleOwnerFilesCount / totalFilesCount : 0;
  let score = 10 - Math.round(concentrationRatio * 10);
  score = Math.max(1, Math.min(10, score));

  return {
    score,
    flaggedFiles: flaggedFiles.slice(0, 50),
    details: {
      fileAuthors,
      authors: Array.from(allAuthors),
    } satisfies BusFactorDetails,
  };
}

export async function analyzeGitHubArchive(repoPath: string, source: RepoSourceInfo, activeFiles: Set<string>) {
  const commits = await fetchCommitSummaries(source.owner, source.repo, source.branch);

  const fileCounts: Record<string, number> = {};
  const countMap: Record<string, number> = {};
  const fileAuthors: Record<string, Record<string, number>> = {};
  const fileAuthorDates: Record<string, Record<string, number>> = {};
  const commitTypes = { feat: 0, fix: 0, refactor: 0, chore: 0, other: 0 };

  for (const commit of commits) {
    const author = commit.author || 'Unknown';
    const commitDate = new Date(commit.date).getTime() || Date.now();

    countMap[author] = (countMap[author] || 0) + 1;
    commitTypes[classifyCommitType(commit.message)]++;

    for (const file of commit.files) {
      if (!file.filename || !activeFiles.has(file.filename)) continue;

      fileCounts[file.filename] = (fileCounts[file.filename] || 0) + 1;

      const impact = Math.max(1, Math.min(1000, (file.additions || 0) + (file.deletions || 0)));
      if (!fileAuthors[file.filename]) fileAuthors[file.filename] = {};
      fileAuthors[file.filename][author] = (fileAuthors[file.filename][author] || 0) + impact;

      if (!fileAuthorDates[file.filename]) fileAuthorDates[file.filename] = {};
      fileAuthorDates[file.filename][author] = Math.max(fileAuthorDates[file.filename][author] || 0, commitDate);
    }
  }

  const sortedFiles = Object.entries(fileCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 250);

  const sortedDevs = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
  const devs = sortedDevs.map((entry) => entry[0]);
  const counts = sortedDevs.map((entry) => entry[1]);
  const totalCommits = commits.length;

  let topContributor = null;
  if (devs.length > 0 && totalCommits > 0) {
    topContributor = {
      name: devs[0],
      pct: Math.round((counts[0] / totalCommits) * 100),
    };
  }

  const busFactor = computeBusFactorFromOwnership(fileAuthors);

  const churnMap = new Map<string, number>(sortedFiles.map((entry) => [entry[0], entry[1]]));
  const topFiles: Array<{ file: string; score: number; reason: string; owner: string }> = [];
  let totalScore = 0;

  for (const flagged of busFactor.flaggedFiles) {
    const churnCount = churnMap.get(flagged.file) || 0;

    let fileSize = 1000;
    try {
      fileSize = fs.statSync(path.join(repoPath, flagged.file)).size;
    } catch {
      // Ignore missing files in archive extractions.
    }

    let score = 0;
    let reason = '';

    if (churnCount > 10 && flagged.pct > 80) {
      score = 90 + Math.min(10, churnCount / 5);
      reason = 'High churn + single owner';
    } else if (churnCount > 5 && flagged.pct > 60) {
      score = 70 + Math.min(20, churnCount / 2);
      reason = 'Moderate churn + concentrated ownership';
    } else if (flagged.pct > 90) {
      score = 60;
      reason = 'Extreme single ownership';
    } else {
      continue;
    }

    if (fileSize > 80000) {
      score -= 40;
      reason += ' (Monolith Penalty)';
    } else if (fileSize > 30000) {
      score -= 15;
      reason += ' (Large file Penalty)';
    }

    if (flagged.file.match(/\.(test|spec)\.[jt]sx?$/)) {
      score += 5;
      reason += ' (Test file)';
    } else if (flagged.file.match(/config|setup/)) {
      score += 5;
      reason += ' (Config file)';
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    totalScore += score;

    topFiles.push({
      file: flagged.file,
      score,
      reason,
      owner: flagged.owner,
    });
  }

  topFiles.sort((a, b) => b.score - a.score);
  const automation = {
    repoScore: topFiles.length > 0 ? Math.round(totalScore / topFiles.length) : 100,
    topFiles: topFiles.slice(0, 10),
  };

  const activeFilesList = Array.from(activeFiles);
  const decayFiles: any[] = [];
  let totalRetentionScore = 0;
  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  for (const file of activeFilesList) {
    const authors = fileAuthorDates[file];
    if (!authors) continue;

    let fileSize = 1000;
    try {
      fileSize = fs.statSync(path.join(repoPath, file)).size;
    } catch {
      // Ignore missing files in archive extractions.
    }

    let decayConstant = 100 - Math.min(fileSize, 80000) / 1000;
    decayConstant = Math.max(30, decayConstant);

    let maxRetention = 0;
    const authorRetentions: Array<{ author: string; retention: number; days: number }> = [];

    for (const [author, timestamp] of Object.entries(authors)) {
      const days = (now - timestamp) / msPerDay;
      const retention = Math.exp(-days / decayConstant);
      authorRetentions.push({ author, retention, days });
      if (retention > maxRetention) maxRetention = retention;
    }

    authorRetentions.sort((a, b) => b.retention - a.retention);

    let status = 'Fresh';
    if (maxRetention < 0.1) status = 'Ghost Code';
    else if (maxRetention < 0.25) status = 'Critical';
    else if (maxRetention < 0.5) status = 'Degraded';
    else if (maxRetention < 0.75) status = 'Fading';

    totalRetentionScore += maxRetention;

    decayFiles.push({
      file,
      status,
      maxRetention: Math.round(maxRetention * 100),
      authors: authorRetentions.slice(0, 3).map((authorRetention) => ({
        name: authorRetention.author,
        retention: Math.round(authorRetention.retention * 100),
        daysSince: Math.round(authorRetention.days),
      })),
    });
  }

  const healthScore = activeFilesList.length > 0 ? Math.round((totalRetentionScore / activeFilesList.length) * 100) : 100;
  decayFiles.sort((a, b) => a.maxRetention - b.maxRetention);

  return {
    repoName: source.repo,
    currentBranch: source.branch,
    availableBranches: [source.branch],
    churn: {
      labels: sortedFiles.map((entry) => entry[0]),
      data: sortedFiles.map((entry) => entry[1]),
    },
    busFactor,
    busFactorDetails: busFactor.details,
    workload: {
      devs,
      counts,
      topContributor,
      totalCommits,
    },
    commitTypes,
    automation,
    knowledgeDecay: {
      healthScore,
      files: decayFiles.slice(0, 150),
    },
  };
}

export async function analyzeArchiveRepoOnDisk(repoPath: string) {
  const source = await readRepoSourceInfo(repoPath);
  if (!source) return null;

  const files = await walkDirectory(repoPath);
  const activeFiles = new Set(files);
  return analyzeGitHubArchive(repoPath, source, activeFiles);
}

export function simulateDepartureFromOwnership(busFactorDetails: BusFactorDetails, developer: string) {
  const recomputed = computeBusFactorFromOwnership(busFactorDetails.fileAuthors, developer);
  const orphanedFiles = recomputed.flaggedFiles
    .filter((file) => file.owner === developer && file.pct > 80)
    .map((file) => file.file);

  return {
    after: {
      score: recomputed.score,
      flaggedFiles: recomputed.flaggedFiles.length,
    },
    orphanedFiles,
  };
}