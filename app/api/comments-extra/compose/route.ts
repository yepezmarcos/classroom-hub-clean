// app/api/comments-extra/compose/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { kind, student, settings, context, text, draft } = body || {};

    // Compose a compact prompt from real student data
    const parts: string[] = [];
    parts.push(`You are a helpful teacher assistant creating report card comments.`);
    parts.push(`Student: ${student?.first || ''} ${student?.last || ''}, grade ${student?.grade || ''}`);
    if (student?.flags?.iep) parts.push(`IEP: yes`);
    if (student?.flags?.ell) parts.push(`ELL: yes`);
    if (Array.isArray(student?.courses) && student.courses?.length) parts.push(`Courses: ${student.courses.join(', ')}`);
    parts.push(`Jurisdiction: ${settings?.jurisdiction || 'generic'}, Term: ${context?.term || ''}`);
    parts.push(`Mode: ${context?.mode} ${context?.subject ? `(subject: ${context?.subject})` : ''}`);
    if (kind === 'generate') parts.push(`Task: generate a clean, teacher-ready comment.`);
    if (kind === 'rephrase') parts.push(`Task: rephrase the comment to be clearer, same meaning.`);
    if (kind === 'condense') parts.push(`Task: shorten the comment while keeping key points.`);
    if (kind === 'proofread') parts.push(`Task: fix grammar/tone, keep content and meaning.`);

    const draftBlock =
        context?.mode === 'learning'
            ? (text || '')
            : [`Opener: ${draft?.opener || ''}`, `Evidence: ${draft?.evidence || ''}`, `Next: ${draft?.next || ''}`, `Conclusion: ${draft?.conclusion || ''}`]
                .filter(Boolean)
                .join('\n');

    if (draftBlock) parts.push(`Current draft:\n${draftBlock}`);

    parts.push(`Rules: Write in plain language, no emojis unless already present, keep placeholder braces like {{first}} or {{they}} if included.`);

    const prompt = parts.join('\n');

    // choose model provider (OpenAI preferred)
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
        // graceful fallback so UI still works
        const fallback = (context?.mode === 'learning')
            ? `{{First}} has shown steady progress this term. ${student?.flags?.ell ? 'With targeted language supports, ' : ''}{{they}} is building confidence and consistency.`
            : `Opener: {{First}} has been engaged in ${context?.subject || 'class'}.\n\nEvidence: {{They}} demonstrates growing accuracy and independence on recent tasks.\n\nNext: We will focus on goal-setting and consistent routines.\n\nConclusion: I’m proud of {{their}} effort.`;
        return NextResponse.json(
            context?.mode === 'learning'
                ? { text: fallback }
                : { opener: 'Opener: ' + fallback.split('\n\n')[0].replace(/^Opener:\s*/,''),
                    evidence: fallback.split('\n\n')[1]?.replace(/^Evidence:\s*/,'') || '',
                    nextSteps: fallback.split('\n\n')[2]?.replace(/^Next:\s*/,'') || '',
                    conclusion: fallback.split('\n\n')[3]?.replace(/^Conclusion:\s*/,'') || '' },
            { status: 200 }
        );
    }

    // OpenAI call
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You write concise, professional teacher comments.' },
                { role: 'user', content: prompt }
            ],
            temperature: kind === 'condense' || kind === 'proofread' ? 0.2 : 0.7
        })
    });
    const data = await resp.json();
    const out = data?.choices?.[0]?.message?.content?.trim() || '';

    if (context?.mode === 'learning') {
        return NextResponse.json({ text: out }, { status: 200 });
    }

    // try to split sections if possible
    const split = out.split(/\n{2,}/);
    return NextResponse.json({
        opener: split[0] || '',
        evidence: split[1] || '',
        nextSteps: split[2] || '',
        conclusion: split.slice(3).join('\n\n') || ''
    });
}