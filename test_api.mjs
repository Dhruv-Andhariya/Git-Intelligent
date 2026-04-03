import { execSync } from 'child_process';

async function testAPI() {
  const repoPath = process.cwd();
  console.log(`Testing /api/analyze with path: ${repoPath}`);
  
  try {
    const res = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_path: repoPath })
    });
    
    const data = await res.json();
    console.log('Analysis Status:', res.status);
    if (!res.ok) {
        console.error('Error in analyze API:', data);
        return;
    }
    console.log('Analysis result keys:', Object.keys(data));

    console.log('\nTesting /api/history...');
    const histRes = await fetch(`http://localhost:3000/api/history?repo_path=${encodeURIComponent(repoPath)}`);
    const histData = await histRes.json();
    console.log('History Status:', histRes.status);
    console.log('History data length:', histData.length);

    console.log('\nTesting /api/report...');
    const reportRes = await fetch('http://localhost:3000/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_path: repoPath })
    });
    const reportData = await reportRes.json();
    console.log('Report Status:', reportRes.status);
    console.log('Report generated length:', reportData.report?.length || reportData.error);
    
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testAPI();
