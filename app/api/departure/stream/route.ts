import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getHistory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const repo_path = searchParams.get('repo_path');
  const developer = searchParams.get('developer');
  const orphanedFilesStr = searchParams.get('orphanedFiles');
  const beforeScore = searchParams.get('beforeScore') || '0';
  const afterScore = searchParams.get('afterScore') || '0';

  if (!repo_path || !developer) {
    return new NextResponse('Missing parameters', { status: 400 });
  }

  const parsedOrphans = orphanedFilesStr ? JSON.parse(orphanedFilesStr) : [];
  const orphanedFiles = parsedOrphans.slice(0, 30); // truncate to fit 12k token limits

  // Get the latest analysis to find remaining team members
  const history = getHistory(repo_path, 1);
  let remainingTeam = [];
  if (history.length > 0) {
    const workload = history[0].snapshot.workload;
    remainingTeam = workload.devs.filter((d: string) => d !== developer).map((d: string, i: number) => ({
      name: d,
      commits: workload.counts[i]
    }));
  }

  const simData = {
    orphanedFiles,
    remainingTeam
  };

  const prompt = `ROLE
────
You are a crisis engineering manager who specialises in rapid knowledge 
transfer when a key developer leaves unexpectedly. You have run 
emergency handovers at fast-growing startups where institutional 
knowledge was concentrated in one person and the team had 72 hours to 
redistribute it before production risk became critical. You are calm, 
methodical, and ruthlessly specific. You do not write documentation 
guides — you write triage plans.

OBJECTIVE
─────────
${developer} is leaving this organisation immediately. You have 
been given the exact before-and-after risk data showing what their 
departure does to this codebase. Your job is to write a 72-hour 
emergency handover plan that prevents a knowledge crisis. Every action 
in this plan must name a specific person from the remaining team, a 
specific file or system, and a specific time window. Generic actions 
like "document the codebase" or "schedule a knowledge transfer" are 
not acceptable — every line must be executable by a real person 
starting right now.

CONTEXT
───────
The following data shows the exact state of the codebase before and 
after ${developer}'s departure. The orphaned files listed are 
files where ${developer} was the sole or dominant contributor — 
meaning no one else on the remaining team has meaningful commit history 
on them. The remaining team members are listed with their commit counts 
per file so you know who has the most residual context on each system.

Bus factor before departure: ${beforeScore}/10
Bus factor after departure:  ${afterScore}/10
Files becoming orphaned:     ${orphanedFiles.length}

The risk delta between before and after tells you how severe this 
departure is. A drop of 3 or more points on the bus factor is a 
crisis-level event. A drop of 1–2 points is serious but manageable 
with fast action.

The remaining team members and their familiarity with each orphaned 
file (measured by historical commit count) are included in the data 
below. Use this to make intelligent assignment decisions — assign the 
person with the most commits on a file as the interim owner, even if 
their count is low. Partial knowledge is better than no knowledge.

DATA
────
${JSON.stringify(simData)}

DELIVERABLE
───────────
Write a 72-hour emergency handover plan structured in exactly four 
time windows. Each time window must contain specific, named, executable 
actions — not categories of actions. Use this structure:

HOUR 0–6: IMMEDIATE TRIAGE
What must happen in the first 6 hours before ${developer} is 
unreachable. Focus on: scheduling extraction sessions, freezing risky 
deployments, and making interim ownership assignments. Name who does 
what. Be specific about what "extraction session" means for each file — 
what questions need to be answered, what decisions need to be recorded.

HOUR 6–24: KNOWLEDGE EXTRACTION
The most critical extraction window while ${developer} may still 
be reachable. For each orphaned file: name the assigned interim owner, 
name the person who should shadow them, and specify what must be 
documented before this window closes. Prioritise files by production 
risk — payment systems, authentication, and data pipelines before 
utilities and config.

HOUR 24–48: REDISTRIBUTION AND DOCUMENTATION
Active work begins on the orphaned files with new owners. Specify what 
automated tests must be written to document expected behaviour before 
any new commits are made. Name who writes which tests. Specify what 
architecture decision records must be created.

HOUR 48–72: STABILISATION
By this window the immediate crisis should be contained. Specify: what 
must be frozen (no new features on these files for how long), what 
monitoring must be added, what the hiring or transfer plan should be 
if the knowledge gap is too large for the remaining team to absorb.

After the four time windows, write one final paragraph titled 
ONGOING RISK — naming which file or system remains the highest risk 
after the 72-hour plan is complete and what the 30-day follow-up 
action should be.

Tone: calm, direct, military-grade clarity. No hedging. No passive 
voice. Every sentence is an instruction or a fact. Write as if this 
plan will be read at 9am on a Monday morning when someone just handed 
in their notice.`;

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
        let errorMsg = 'Failed to generate handover plan.';
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
