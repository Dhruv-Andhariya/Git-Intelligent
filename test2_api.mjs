async function testReport() {
  const repoPath = process.cwd();
  console.log(`Testing /api/report with path: ${repoPath}`);
  
  try {
    const reportRes = await fetch('http://localhost:3000/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_path: repoPath })
    });
    const text = await reportRes.text();
    console.log('Report Status:', reportRes.status);
    console.log('Report Body:', text.substring(0, 500));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testReport();
