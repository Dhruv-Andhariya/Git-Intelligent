import { getGitClient, analyzeChurn, analyzeWorkload, analyzeCommitTypes, analyzeBusFactor, analyzeAutomation } from './lib/git-analyzer';
import fs from 'fs';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const repoPathIdx = args.indexOf('--repo');
  const formatIdx = args.indexOf('--format');
  
  const repoPath = repoPathIdx > -1 ? args[repoPathIdx + 1] : process.cwd();
  const format = formatIdx > -1 ? args[formatIdx + 1] : 'json';

  if (!fs.existsSync(repoPath)) {
    console.error(`Error: Path does not exist: ${repoPath}`);
    process.exit(1);
  }

  const git = getGitClient(repoPath);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    console.error(`Error: Not a git repository: ${repoPath}`);
    process.exit(1);
  }

  try {
    const lsTreeRaw = await git.raw(['ls-tree', '-r', 'HEAD', '--name-only']);
    const activeFilesSet = new Set(lsTreeRaw.split('\n').map(f => f.trim()).filter(Boolean));

    const [churn, workload, commitTypes, busFactor] = await Promise.all([
      analyzeChurn(repoPath, activeFilesSet),
      analyzeWorkload(repoPath),
      analyzeCommitTypes(repoPath),
      analyzeBusFactor(repoPath, activeFilesSet)
    ]);
    const automation = await analyzeAutomation(repoPath, churn, busFactor);

    const result = {
      repoName: path.basename(repoPath),
      analyzedAt: new Date().toISOString(),
      churn,
      workload,
      commitTypes,
      busFactor,
      automation
    };

    if (format === 'ci') {
      console.log(`\n=== GitLens Intelligence CI Report ===`);
      console.log(`Repository: ${result.repoName}`);
      console.log(`Analyzed At: ${result.analyzedAt}`);
      console.log(`--------------------------------------`);
      console.log(`Bus Factor Score: ${busFactor.score}/10`);
      console.log(`Critical Single-Owner Files: ${busFactor.flaggedFiles.length}`);
      console.log(`Top Contributor: ${workload.topContributor?.name || 'N/A'} (${workload.topContributor?.pct || 0}%)`);
      console.log(`Automation Opportunity Score: ${automation.repoScore}/100`);
      console.log(`--------------------------------------`);
      
      if (busFactor.score < 4) {
        console.log(`⚠️ WARNING: Bus Factor is critical. High risk of knowledge silos.`);
      }
      if ((workload.topContributor?.pct || 0) > 50) {
        console.log(`⚠️ WARNING: Workload imbalance. ${workload.topContributor?.name} owns >50% of commits.`);
      }
      
      console.log(`======================================\n`);
      
      // Exit with code 1 if bus factor is extremely critical to fail CI
      if (busFactor.score <= 2) {
        console.error(`Failing CI pipeline due to critical Bus Factor score (<= 2).`);
        process.exit(1);
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error during analysis:', error);
    process.exit(1);
  }
}

main();
