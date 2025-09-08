import { Body, Controller, Post } from '@nestjs/common';
import { OpenAIService } from './openai.service';

type SuggestReq = {
  context?: string;                 // 'comments' | ...
  partialText?: string;             // what the user has typed so far
  placeholders?: string[];          // e.g. ["{{student_first}}","{{he_she}}",...]
  tone?: 'positive'|'formal'|'growth'|'concise';
  subject?: string|null;
  gradeBand?: string|null;
  standardType?: 'GENERAL'|'SUBJECT';
  setId?: string;
  category?: string|null;
  skillIds?: string[];
};

@Controller('ai')
export class AiController {
  constructor(private readonly ai: OpenAIService) {}

  @Post('suggest/comments')
  async suggest(@Body() body: SuggestReq) {
    const {
      partialText = '',
      placeholders = [],
      tone = 'positive',
      subject = null,
      gradeBand = null,
      standardType = 'GENERAL',
      category = null,
    } = body || {};

    // Fallback suggestions (no API key, or model hiccup). Ensure placeholders appear.
    const fallback = {
      suggestions: [
        `${partialText ? partialText + ' ' : ''}{{student_first}} has shown steady progress in ${subject || '{{subject}}'}.`,
        `${partialText ? partialText + ' ' : ''}Encourage {{him_her}} to keep practicing, especially with {{next_step}}.`,
        `${partialText ? partialText + ' ' : ''}{{he_she}} demonstrates strong {{strength}} during class activities.`,
        `${partialText ? partialText + ' ' : ''}In ${subject || '{{subject}}'}, {{student_first}} is engaged and participates often.`,
        `${partialText ? partialText + ' ' : ''}Next, we’ll focus on {{next_step}} to build confidence.`,
        `${partialText ? partialText + ' ' : ''}{{their}} effort this term has been consistent — great job!`,
      ],
    };

    // Build prompt for the model
    const tokList = placeholders.length ? placeholders.join(', ') : '{{student_first}}, {{he_she}}, {{their}}, {{subject}}, {{next_step}}, {{strength}}';
    const prompt = `
You generate SHORT, clean, partial comment completions for a teacher.
They will be inserted into an existing textarea at the cursor.

Context:
- Tone: ${tone}
- Mode: ${standardType} ${category ? `(category: ${category})` : ''}
- Subject: ${subject || 'n/a'}
- Grade band: ${gradeBand || 'n/a'}
- Allowed placeholders (MUST use at least one in most suggestions): ${tokList}

Requirements:
- Return strict JSON: {"suggestions":[string,...]} (5–8 items).
- DO NOT include quotes, markdown, or extra fields.
- Keep each suggestion one sentence, ~6–16 words.
- Natural language, and where relevant, mix in the placeholders (e.g., "{{student_first}}", "{{he_she}}").
- If partialText is provided, you may continue its thought, otherwise create complete standalone sentences.

partialText start:
"""${partialText}"""
`;

    const json = await this.ai.json<{ suggestions: string[] }>(prompt, fallback);

    // Last safety: dedupe/trim and ensure at least something comes back.
    const out = Array.from(new Set((json?.suggestions ?? []).map(s => (s || '').trim()).filter(Boolean)));
    return { suggestions: out.length ? out : fallback.suggestions };
  }
}