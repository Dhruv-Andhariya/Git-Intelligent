import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: NextRequest) {
  try {
    const { decayData, devs } = await req.json();

    if (!decayData) {
      return new NextResponse('Missing decay data', { status: 400 });
    }

    const limitedFiles = decayData.files.slice(0, 15);

    const decayMetricsJson = JSON.stringify({
      files: limitedFiles,
      team: devs
    });

    const prompt = `ROLE
────
You are an institutional memory analyst who specialises in identifying 
when engineering teams are about to lose critical knowledge — not 
because people are leaving, but because human memory fades. You 
understand the Ebbinghaus forgetting curve and can translate decay 
mathematics into urgent, specific, human language. You write for 
engineering managers who need to act before the knowledge is gone, 
not after.

OBJECTIVE
─────────
Analyse the knowledge decay data provided below and write a transfer 
narrative that makes three things immediately clear: which files are 
already in crisis (ghost code), which files are approaching the point 
of no return, and which specific developers still carry partial 
knowledge that must be extracted before their retention decays further. 
This narrative will be read by an engineering manager who needs to 
decide in the next 48 hours who to pull into a knowledge transfer 
session and what to ask them.

CONTEXT
───────
The decay data below was computed using an Ebbinghaus-inspired 
retention model applied to Git commit history. The model works as 
follows:

- Every time a developer commits to a file, their knowledge retention 
  on that file resets to 100%.

- Knowledge decays exponentially over time following the forgetting 
  curve: retention = e^(−days_since_last_touch / decay_constant). 
  The decay constant is calibrated so that a developer who has not 
  touched a file in 180 days retains approximately 30% of their 
  working knowledge of it.

- A file's overall knowledge coverage is the sum of all active 
  contributors' weighted retention scores. Coverage below 20% means 
  the file is effectively unmaintained — no one remembers how it works 
  well enough to safely modify it.

Status labels in the data mean the following:
- FRESH: coverage above 80% — well understood by active contributors
- FADING: coverage 60–80% — knowledge declining, monitor closely  
- DEGRADED: coverage 40–60% — meaningful knowledge loss has occurred, 
  transfer sessions recommended within 30 days
- CRITICAL: coverage 20–40% — high risk, transfer sessions urgent, 
  any production incident on this file will be slow to resolve
- GHOST CODE: coverage below 20% — no one on the current team 
  effectively remembers how this file works; it is running in 
  production on institutional memory that no longer exists

The data also includes projection dates — the date when each file 
is estimated to cross each threshold if no action is taken. Use these 
dates to create urgency proportional to imminence.

DATA
────
${decayMetricsJson}

DELIVERABLE
───────────
Write a knowledge decay transfer narrative in exactly three sections. 
No markdown headers — use plain section titles in capitals followed 
by a line break. Each section is prose, not bullets.

GHOST CODE ALERT
Name every file currently classified as GHOST CODE. For each: state 
its current coverage percentage, how many days ago the last contributor 
touched it, and what the business consequence is if this file breaks 
today — be specific about what that file does and why its failure 
matters. If any ghost code file is in a payment, authentication, or 
data pipeline system, say so explicitly and escalate the urgency. End 
this section with a single sentence stating the total number of files 
in ghost code status and whether this represents an acceptable risk 
for a production system.

WHO STILL KNOWS WHAT
For every file in CRITICAL or DEGRADED status, name the developer 
with the highest remaining retention score on that file, state their 
exact retention percentage, and state exactly how many days remain 
before their retention crosses below the critical threshold. This is 
the extraction window — the time available to run a knowledge transfer 
session before even partial knowledge is gone. Sequence these by 
urgency: shortest extraction window first. End this section by naming 
the single developer in this codebase who carries the most at-risk 
institutional knowledge — the person who must be prioritised for 
knowledge transfer sessions above all others.

TRANSFER SESSION PLAN
Write a prioritised, sequenced plan for knowledge transfer sessions 
over the next 30 days. For each session: name the file or system, 
name the knowledge holder who must lead it, name the suggested 
recipient who should shadow them, and state the deadline (the date 
before the holder's retention crosses critical). Be specific about 
what each session must capture — not "document the system" but the 
specific decisions, edge cases, and institutional context that only 
this person holds. Limit to the top 5 most urgent sessions — if there 
are more than 5 files in critical or degraded status, note at the end 
how many additional sessions are needed in the 30–60 day window.

Tone: urgent but not alarmist, precise but human. This narrative will 
be read by a manager who cares about their team. Acknowledge that 
knowledge decay is natural and inevitable — the goal is not to blame 
anyone, it is to act before the window closes.`;

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
          let errorMsg = 'Failed to generate narrative.';
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
  } catch (err) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
