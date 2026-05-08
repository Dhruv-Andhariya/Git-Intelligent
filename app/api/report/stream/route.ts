import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getHistory } from '@/lib/db';
import { analyzeArchiveRepoOnDisk } from '@/lib/github-archive-analyzer';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const repo_path = searchParams.get('repo_path');

  if (!repo_path) {
    return new NextResponse('Missing repo_path', { status: 400 });
  }

  // Get the latest analysis for this repo or analyze archive repos on demand.
  const history = getHistory(repo_path, 1);
  const snapshot = history[0]?.snapshot || await analyzeArchiveRepoOnDisk(repo_path);
  if (!snapshot) {
    return new NextResponse('No analysis found for this repo', { status: 404 });
  }
  
  // Construct a minimal payload containing only what the Health Report needs
  const analysisData = {
    repoName: snapshot.repoName,
    churn: {
      labels: snapshot.churn?.labels?.slice(0, 30) || [],
      data: snapshot.churn?.data?.slice(0, 30) || []
    },
    busFactor: {
      score: snapshot.busFactor?.score,
      flaggedFiles: snapshot.busFactor?.flaggedFiles?.slice(0, 15) || []
    },
    workload: snapshot.workload,
    commitTypes: snapshot.commitTypes,
    automation: snapshot.automation
  };

  const prompt = `ROLE
────
You are a principal engineering advisor with 20 years of experience 
helping CTOs and VPs of Engineering identify codebase risk before it 
becomes a business crisis. You communicate with the precision of a 
senior developer and the clarity of a management consultant. You name 
specific files, specific people, and specific numbers — you never give 
generic advice.

OBJECTIVE
─────────
Analyse the structured Git intelligence data provided below and write 
a 4-paragraph health report for this specific repository. Your report 
must make the current state of this codebase immediately legible to 
both a senior developer and a CTO who has never opened a terminal. 
Every claim you make must be traceable to a number in the data. 
Do not invent, extrapolate, or generalise beyond what the data shows.

CONTEXT
───────
This data was computed programmatically from the repository's full Git 
history — every commit, every author, every file, every timestamp. 
The numbers are exact, not sampled. The people named are real 
contributors. The files named are real production files. The fix rate, 
ownership percentages, and churn counts reflect the actual last 90 days 
of activity on this codebase.

The four signals in the data mean the following:

- Churn: how many times each file was modified in 90 days. High churn 
  on a file means it is unstable — frequently broken or frequently 
  changed under pressure.

- Bus Factor Score (1–10): how concentrated commit ownership is across 
  the repo. A score below 4 means one or two people leaving would make 
  large parts of the codebase unmaintainable. A score above 7 means 
  knowledge is well distributed.

- Commit Type Distribution: the ratio of fix commits to feature commits. 
  A fix rate above 35% indicates the team is firefighting more than 
  building. Above 50% is a systemic instability signal.

- Automation Score (0–100): how much of the team's repetitive, 
  single-author, high-churn work could be handed to AI agents. Above 
  70 means significant ROI is available from AI tooling investment.

The audience for this report is: the engineering manager who will act 
on it today, and the CTO who may present it to a board next week.

DATA
────
${JSON.stringify(analysisData)}

DELIVERABLE
───────────
Write exactly 4 paragraphs. No headers. No bullet points. No markdown. 
Plain prose only. Each paragraph must serve one specific purpose:

Paragraph 1 — CURRENT STATE
Summarise the overall health of this codebase in 4–6 sentences. Lead 
with the bus factor score and what it means in plain English. Name the 
top contributor by name and their exact commit percentage. State whether 
the team is primarily building or firefighting based on the commit type 
ratio.

Paragraph 2 — TOP RISKS
Identify the two highest-risk situations in this codebase right now. 
For each risk: name the exact file, name the exact owner, state the 
exact ownership percentage, and explain in one sentence what failure 
mode this creates for the business — not for the code. Be specific 
about consequence, not just cause.

Paragraph 3 — AUTOMATION OPPORTUNITY
Identify the top two or three files where AI agent investment would 
deliver the highest return. Name each file, state its automation score, 
and explain in one sentence why it is a strong candidate. End this 
paragraph with an estimate of developer hours per sprint that could be 
reclaimed if these files were handed to AI agents.

Paragraph 4 — 2-WEEK ACTION PLAN
Give a concrete, sequenced action plan for the next two weeks. Name 
specific developers for specific actions. Sequence by urgency. Be 
direct — this is a plan, not a suggestion. End with one sentence on 
what the bus factor score should reach in 30 days if this plan is 
followed.

Tone: direct, specific, urgent where warranted, never alarmist. 
Write as if your reputation depends on the accuracy of every number 
you cite — because it does.`;

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const responseStream = await groq.chat.completions.create({
          messages: [{ role: 'system', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          temperature: 0,
          stream: true,
        });

        const encoder = new TextEncoder();
        for await (const chunk of responseStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            const data = JSON.stringify({ text: content });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error: any) {
        console.error('Groq streaming error:', error);
        let errorMsg = 'Failed to generate report.';
        if (error?.message) {
          if (error.message.includes('Too Many Requests') || error.message.includes('429')) {
            errorMsg = 'Groq API Rate Limit Exceeded. Please wait a minute and try again on the free tier.';
          } else {
            try {
               const parsed = JSON.parse(error.message);
               errorMsg = parsed.error?.message || error.message;
            } catch {
               errorMsg = error.message;
            }
          }
        }
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
