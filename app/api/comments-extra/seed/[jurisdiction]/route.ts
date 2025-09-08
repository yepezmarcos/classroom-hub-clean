import { NextResponse } from 'next/server';
import { prisma } from '../../../_lib/db';

function baseLS(tagsBase: string[]) {
  return [
    // Openers (tag with level)
    { text: '🟢 {{First}} has demonstrated strong learning skills this term.', tags: [...tagsBase,'opener','level:E'] },
    { text: '🟡 {{First}} is making steady progress in learning skills.',       tags: [...tagsBase,'opener','level:G'] },
    { text: '🟠 {{First}} is developing learning skills with growing consistency.', tags: [...tagsBase,'opener','level:S'] },
    { text: '🔴 {{First}} would benefit from additional support to build learning skills.', tags: [...tagsBase,'opener','level:N'] },

    // Category statements (examples; you can add 100s via CSV import later)
    { text: '{{First}} submits assignments on time and takes responsibility for {{their}} learning.', tags: [...tagsBase,'responsibility','level:E'] },
    { text: '{{First}} is organizing materials more consistently.', tags: [...tagsBase,'organization','level:G'] },
    { text: '{{First}} completes tasks with reminders and support.', tags: [...tagsBase,'independent-work','level:S'] },
    { text: '{{First}} is learning to collaborate respectfully with peers.', tags: [...tagsBase,'collaboration','level:S'] },
    { text: '{{First}} shows initiative by volunteering and taking on challenges.', tags: [...tagsBase,'initiative','level:E'] },
    { text: '{{First}} is developing strategies to self-regulate during work time.', tags: [...tagsBase,'self-regulation','level:S'] },

    // Next steps (tag by category)
    { text: 'Continue to use a planner to record tasks and deadlines.', tags: [...tagsBase,'next-steps','organization'] },
    { text: 'Set a small goal each class and reflect briefly at the end.', tags: [...tagsBase,'next-steps','responsibility'] },
    { text: 'Use checklists to complete multi-step tasks independently.', tags: [...tagsBase,'next-steps','independent-work'] },
    { text: 'Invite a peer to share ideas and build on others’ thinking.', tags: [...tagsBase,'next-steps','collaboration'] },
    { text: 'Seek feedback and try an extension task when finished early.', tags: [...tagsBase,'next-steps','initiative'] },
    { text: 'Practice short breaks and deep breaths to refocus.', tags: [...tagsBase,'next-steps','self-regulation'] },

    // Email samples
    { text: 'Hello {{guardian_name}}, {{First}} has been making steady progress in {{subject_or_class}}…', subject: 'Quick update about {{first}}', tags: ['email','topic:Progress',...tagsBase] },
    { text: 'Hello {{guardian_name}}, I’m reaching out regarding {{first}}’s recent challenges with…', subject: 'Support plan for {{first}}', tags: ['email','topic:Concern',...tagsBase] },
  ];
}

export async function POST(_: Request, { params }: { params: { jur: string } }) {
  const jur = params.jur?.toLowerCase?.() || 'generic';
  const tagsBase = ['learning', jur];

  // Seed if bank looks empty for this jurisdiction
  const existing = await prisma.commentTemplate.count({
    where: { tags: { has: jur } }
  });
  if (existing > 0) return NextResponse.json({ ok: true, seeded: false });

  await prisma.$transaction(
    baseLS(tagsBase).map(t =>
      prisma.commentTemplate.create({
        data: {
          text: t.text,
          tags: t.tags as string[],
          subject: (t as any).subject || null
        }
      })
    )
  );

  return NextResponse.json({ ok: true, seeded: true });
}