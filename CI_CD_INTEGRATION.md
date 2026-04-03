# GitLens Intelligence CI/CD Integration

GitLens Intelligence includes a CLI tool that can be integrated into your CI/CD pipelines to automatically assess codebase health, bus factor risk, and automation opportunities on every push or schedule.

## Usage

Run the CLI using `npx tsx cli.ts`:

```bash
# Output JSON report for the current directory
npx tsx cli.ts

# Specify a repository path
npx tsx cli.ts --repo /path/to/your/repo

# Output a human-readable CI format
npx tsx cli.ts --repo /path/to/your/repo --format ci
```

*Note: When using `--format ci`, the script will exit with code `1` (failing the pipeline) if the Bus Factor score is critically low (<= 2).*

---

## GitHub Actions Integration

Create a workflow file in your repository at `.github/workflows/gitlens-intelligence.yml`:

```yaml
name: GitLens Intelligence Health Check

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]
  schedule:
    - cron: '0 0 * * 1' # Run weekly on Mondays

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Important: Fetch full history for accurate git log analysis

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run GitLens Intelligence CLI
        run: npx tsx cli.ts --repo . --format ci
```

---

## GitLab CI Integration

Add the following job to your `.gitlab-ci.yml` file:

```yaml
gitlens_health_check:
  stage: test
  image: node:20
  variables:
    GIT_DEPTH: 0 # Important: Fetch full history for accurate git log analysis
  script:
    - npm ci
    - npx tsx cli.ts --repo . --format ci
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

## Customizing CI Failure Thresholds

If you want to customize when the CI pipeline fails, you can parse the JSON output instead of using `--format ci` and use `jq` to evaluate the scores:

```bash
# Example: Fail if Automation Score is below 50
SCORE=$(npx tsx cli.ts --repo . --format json | jq '.automation.repoScore')
if [ "$SCORE" -lt 50 ]; then
  echo "Automation score too low!"
  exit 1
fi
```
