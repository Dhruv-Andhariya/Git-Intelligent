import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import { spawn } from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

export function getGitClient(repoPath: string): SimpleGit {
  const options: Partial<SimpleGitOptions> = {
    baseDir: repoPath,
    binary: 'git',
    maxConcurrentProcesses: 6,
    trimmed: false,
    config: ['core.quotePath=false'],
  };
  return simpleGit(options);
}

async function streamGitLog(repoPath: string, args: string[], onLine: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', ['log', ...args], { cwd: repoPath });
    const rl = readline.createInterface({ input: proc.stdout, terminal: false });

    rl.on('line', (line) => {
      onLine(line);
    });

    rl.on('close', () => resolve());
    proc.on('error', (err) => reject(err));
  });
}

export async function analyzeChurn(repoPath: string, activeFiles: Set<string>, branch: string = '--all') {
  try {
    const fileCounts: Record<string, number> = {};

    await streamGitLog(repoPath, [branch, '--name-only', '--pretty=format:'], (line) => {
      const file = line.trim();
      if (file && activeFiles.has(file)) {
        fileCounts[file] = (fileCounts[file] || 0) + 1;
      }
    });

    const sortedFiles = Object.entries(fileCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 250);

    return {
      labels: sortedFiles.map(f => f[0]),
      data: sortedFiles.map(f => f[1])
    };
  } catch (error) {
    console.error("Error analyzing churn:", error);
    return { labels: [], data: [] };
  }
}

export async function analyzeWorkload(repoPath: string, branch: string = '--all') {
  try {
    const countMap: Record<string, number> = {};
    let totalCommits = 0;

    await streamGitLog(repoPath, [branch, '--pretty=format:%an'], (line) => {
      const name = line.trim();
      if (name) {
        countMap[name] = (countMap[name] || 0) + 1;
        totalCommits++;
      }
    });

    const sortedDevs = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
    const devs = sortedDevs.map(d => d[0]);
    const counts = sortedDevs.map(d => d[1]);

    let topContributor = null;
    if (devs.length > 0 && totalCommits > 0) {
      topContributor = {
        name: devs[0],
        pct: Math.round((counts[0] / totalCommits) * 100)
      };
    }

    return { devs, counts, topContributor, totalCommits };
  } catch (error) {
    console.error("Error analyzing workload:", error);
    return { devs: [], counts: [], topContributor: null, totalCommits: 0 };
  }
}

export async function analyzeCommitTypes(repoPath: string, branch: string = '--all') {
  try {
    const types = { feat: 0, fix: 0, refactor: 0, chore: 0, other: 0 };

    await streamGitLog(repoPath, [branch, '--pretty=%s'], (line) => {
      const lowerLine = line.trim().toLowerCase();
      if (!lowerLine) return;
      if (lowerLine.match(/^(fix|bug|hotfix|patch|revert)\b/)) types.fix++;
      else if (lowerLine.match(/^(feat|add|new|implement|create)\b/)) types.feat++;
      else if (lowerLine.match(/^(refactor|clean|restructure|rename)\b/)) types.refactor++;
      else if (lowerLine.match(/^(chore|update|bump|upgrade|deps)\b/)) types.chore++;
      else types.other++;
    });

    return types;
  } catch (error) {
    console.error("Error analyzing commit types:", error);
    return { feat: 0, fix: 0, refactor: 0, chore: 0, other: 0 };
  }
}

export async function analyzeBusFactor(repoPath: string, activeFiles: Set<string>, excludeDeveloper?: string, branch: string = '--all') {
  try {
    const fileAuthors: Record<string, Record<string, number>> = {};
    const ALL_AUTHORS = new Set<string>();

    let currentAuthor = '';

    await streamGitLog(repoPath, [branch, '--numstat', '--pretty=format:---C---%n%an'], (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed === '---C---') {
        currentAuthor = '';
      } else if (!currentAuthor && !trimmed.includes('\t')) {
        currentAuthor = trimmed;
        ALL_AUTHORS.add(currentAuthor);
      } else if (currentAuthor && trimmed.includes('\t')) {
        if (excludeDeveloper && currentAuthor === excludeDeveloper) return;
        const parts = trimmed.split('\t');
        if (parts.length === 3) {
          const added = parseInt(parts[0], 10) || 0;
          const deleted = parseInt(parts[1], 10) || 0;
          const file = parts[2].trim();

          if (activeFiles.has(file)) {
            let impact = added + deleted;
            if (impact === 0) impact = 1;
            impact = Math.min(impact, 1000);

            if (!fileAuthors[file]) fileAuthors[file] = {};
            fileAuthors[file][currentAuthor] = (fileAuthors[file][currentAuthor] || 0) + impact;
          }
        }
      }
    });

    const flaggedFiles = [];
    let singleOwnerFilesCount = 0;
    let totalFilesCount = 0;

    for (const [file, authorCounts] of Object.entries(fileAuthors)) {
      totalFilesCount++;
      let totalCommits = 0;
      let fileRawTotal = 0;

      for (const count of Object.values(authorCounts)) fileRawTotal += count;
      const osmosisBonus = fileRawTotal * 0.05;

      let topAuthor = '';
      let topAuthorCommits = 0;

      for (const author of ALL_AUTHORS) {
        if (excludeDeveloper && author === excludeDeveloper) continue;
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
            commits: Math.round(totalCommits)
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
      flaggedFiles: flaggedFiles.slice(0, 50)
    };
  } catch (error) {
    console.error("Error analyzing bus factor:", error);
    return { score: 10, flaggedFiles: [] };
  }
}

export async function analyzeAutomation(repoPath: string, churnData: any, busFactorData: any) {
  const churnMap = new Map<string, number>(churnData.labels.map((label: string, i: number) => [label, churnData.data[i]]));

  const topFiles = [];
  let totalScore = 0;

  for (const flagged of busFactorData.flaggedFiles) {
    const churnCount = churnMap.get(flagged.file) || 0;

    let fileSize = 1000;
    try {
      fileSize = fs.statSync(path.join(repoPath, flagged.file)).size;
    } catch (e) { }

    let score = 0;
    let reason = "";

    if (churnCount > 10 && flagged.pct > 80) {
      score = 90 + Math.min(10, churnCount / 5);
      reason = "High churn + single owner";
    } else if (churnCount > 5 && flagged.pct > 60) {
      score = 70 + Math.min(20, churnCount / 2);
      reason = "Moderate churn + concentrated ownership";
    } else if (flagged.pct > 90) {
      score = 60;
      reason = "Extreme single ownership";
    } else {
      continue;
    }

    // Heavy penalty for monoliths (> 80KB ~ 2500 lines)
    if (fileSize > 80000) {
      score -= 40;
      reason += " (Monolith Penalty)";
    } else if (fileSize > 30000) {
      score -= 15;
      reason += " (Large file Penalty)";
    }

    if (flagged.file.match(/\\.(test|spec)\\.[jt]sx?$/)) {
      score += 5;
      reason += " (Test file)";
    } else if (flagged.file.match(/config|setup/)) {
      score += 5;
      reason += " (Config file)";
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    totalScore += score;

    topFiles.push({
      file: flagged.file,
      score,
      reason,
      owner: flagged.owner
    });
  }

  topFiles.sort((a, b) => b.score - a.score);
  const repoScore = topFiles.length > 0 ? Math.round(totalScore / topFiles.length) : 100;

  return {
    repoScore,
    topFiles: topFiles.slice(0, 10)
  };
}

export async function analyzeKnowledgeDecay(repoPath: string, activeFilesSet: Set<string>, branch: string = '--all') {
  try {
    const activeFiles = Array.from(activeFilesSet);
    const fileAuthorDates: Record<string, Record<string, number>> = {};

    let currentAuthor = '';
    let currentTimestamp = 0;
    let blockStep = 0;

    await streamGitLog(repoPath, [branch, '--name-only', '--date=iso-strict', '--pretty=format:---C---%n%an%n%ad'], (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed === '---C---') {
        blockStep = 0;
        currentAuthor = '';
      } else if (blockStep === 0) {
        currentAuthor = trimmed;
        blockStep = 1;
      } else if (blockStep === 1) {
        currentTimestamp = new Date(trimmed).getTime();
        blockStep = 2;
      } else if (blockStep === 2) {
        const file = trimmed;
        if (activeFilesSet.has(file)) {
          if (!fileAuthorDates[file]) fileAuthorDates[file] = {};
          if (!fileAuthorDates[file][currentAuthor]) {
            fileAuthorDates[file][currentAuthor] = currentTimestamp;
          } else {
            fileAuthorDates[file][currentAuthor] = Math.max(fileAuthorDates[file][currentAuthor], currentTimestamp);
          }
        }
      }
    });

    const now = Date.now();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const decayFiles = [];
    let totalScore = 0;

    for (const file of activeFiles) {
      const authors = fileAuthorDates[file];
      if (!authors) continue;

      let fileSize = 1000;
      try {
        fileSize = fs.statSync(path.join(repoPath, file)).size;
      } catch (e) { }

      let decay_constant = 100 - (Math.min(fileSize, 80000) / 1000);
      decay_constant = Math.max(30, decay_constant);

      let maxRetention = 0;
      const authorRetentions = [];

      for (const [author, timestamp] of Object.entries(authors)) {
        const days = (now - timestamp) / MS_PER_DAY;
        const retention = Math.exp(-days / decay_constant);
        authorRetentions.push({ author, retention, days });
        if (retention > maxRetention) maxRetention = retention;
      }

      authorRetentions.sort((a, b) => b.retention - a.retention);

      let status = 'Fresh';
      if (maxRetention < 0.1) status = 'Ghost Code';
      else if (maxRetention < 0.25) status = 'Critical';
      else if (maxRetention < 0.5) status = 'Degraded';
      else if (maxRetention < 0.75) status = 'Fading';

      totalScore += maxRetention;

      decayFiles.push({
        file,
        status,
        maxRetention: Math.round(maxRetention * 100),
        authors: authorRetentions.slice(0, 3).map(a => ({
          name: a.author,
          retention: Math.round(a.retention * 100),
          daysSince: Math.round(a.days)
        }))
      });
    }

    const healthScore = activeFiles.length > 0 ? Math.round((totalScore / activeFiles.length) * 100) : 100;

    decayFiles.sort((a, b) => a.maxRetention - b.maxRetention);

    return {
      healthScore,
      files: decayFiles.slice(0, 150)
    };
  } catch (error) {
    console.error("Error analyzing knowledge decay:", error);
    return { healthScore: 0, files: [] };
  }
}
