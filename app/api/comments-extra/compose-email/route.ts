import { NextResponse } from 'next/server';

type Payload = {
  kind: 'generate' | 'rephrase' | 'condense' | 'proofread';
  student?: { first?: string; last?: string; grade?: string | null };
  topic?: string;   // e.g., "Progress"
  tone?: 'Neutral'|'Warm'|'Professional'|'Encouraging'|'Direct';
  subject?: string;
  body?: string;
};

function tidy(s?: string) { return (s || '').replace(/\s+/g, ' ').trim(); }
function sentences(s: string, n: number) {
  const parts = s.split(/[.!?]\s+/).filter(Boolean);
  return (parts.slice(0, n).join('. ') + (parts.length ? '.' : '')).trim();
}

export async function POST(req: Request) {
  const p = (await req.json()) as Payload;
  const name = p?.student?.first || 'The student';
  const topic = (p?.topic || 'General').toLowerCase();
  const tone = p?.tone || 'Neutral';

  let subject = p.subject || '';
  let body = p.body || '';

  if (p.kind === 'generate' || (!subject && !body)) {
    // simple deterministic draft
    const subjByTopic: Record<string,string> = {
      progress: `Quick update about ${name}`,
      concern:  `Support plan for ${name}`,
      positive: `Celebrating ${name}’s success`,
      attendance: `${name} — attendance update`,
      behavior: `${name} — classroom update`,
      assignment: `${name} — assignment update`,
      meeting: `Request to meet re: ${name}`,
      general: `Update about ${name}`,
    };
    subject = subjByTopic[topic] || subjByTopic.general;

    const openerByTone: Record<Payload['tone'], string> = {
      Neutral:     `Hello, I wanted to share a brief update about ${name}.`,
      Warm:        `Hello, I hope you’re well — I wanted to share a quick update about ${name}.`,
      Professional:`Hello, I’m reaching out with an update regarding ${name}.`,
      Encouraging: `Hi! I’m excited to share a quick update about ${name}.`,
      Direct:      `Hello, a quick update about ${name}.`,
    };

    body =
`${openerByTone[tone]}

Recently, ${name} has shown steady progress in class. I’ve noticed positive steps with daily routines and participation.

Next, we’ll focus on goal-setting and using feedback to improve work. Any support you can offer at home (e.g., checking the planner) would be appreciated.

Thank you for your partnership,
{{teacher_name}}`;
  }

  if (p.kind === 'rephrase' || p.kind === 'proofread') {
    subject = tidy(subject);
    body = tidy(body).replace(/\s,/, ',');
  } else if (p.kind === 'condense') {
    subject = tidy(subject);
    body = sentences(tidy(body), 4);
  }

  return NextResponse.json({ subject, body });
}