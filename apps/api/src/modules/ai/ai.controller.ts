import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

type SuggestReq = {
  context: 'comments';
  partialText: string;
  subject?: string | null;
  gradeBand?: string | null;
  standardType: 'GENERAL' | 'SUBJECT';
  setId?: string;
  category?: string | null;
  skillIds?: string[];
  tone?: 'positive' | 'formal' | 'growth' | 'concise';
};

@Controller('ai')
@UseGuards(JwtGuard)
export class AiController {
  private openai?: OpenAI;

  constructor(private prisma: PrismaService) {
    if (process.env.OPENAI_API_KEY) this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  @Post('suggest/comments')
  async suggestComments(@Req() _req: any, @Body() body: SuggestReq) {
    const skills = body.skillIds?.length
      ? await this.prisma.standardSkill.findMany({ where: { id: { in: body.skillIds } } })
      : [];
    const skillText = skills.map((s) => `${s.code ? s.code + ' ' : ''}${s.label}`).join('; ');

    const ctx = [
      `Mode: ${body.standardType === 'GENERAL' ? 'Elementary Learning Skills' : 'Subject Standards'}`,
      body.subject ? `Subject: ${body.subject}` : null,
      body.gradeBand ? `Grade band: ${body.gradeBand}` : null,
      body.category ? `Category: ${body.category}` : null,
      skillText ? `Skills: ${skillText}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (this.openai) {
      const sys =
        `You generate K-12 feedback phrase suggestions.\n` +
        `Return 5 short, varied, high-utility continuations or sentence starters.\n` +
        `KEEP PLACEHOLDERS INTACT (e.g., {{student_first}}, {{he_she}}, {{next_step}}).\n` +
        `Respond as a JSON array of strings.`;

      const user =
        `Context:\n${ctx}\n\n` +
        `Current text:\n${body.partialText || '(empty)'}\n\n` +
        `Make suggestions that fit tone=${body.tone || 'positive'}.`;

      const r = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        temperature: 0.5,
      });

      const content = r.choices?.[0]?.message?.content?.trim() || '[]';
      let suggestions: string[] = [];

      try {
        // Try direct JSON array
        const parsed = JSON.parse(content);
        suggestions = Array.isArray(parsed) ? parsed : (parsed?.suggestions ?? []);
      } catch {
        // Try to pull the first JSON array from the content
        const m = content.match(/\[[\s\S]*\]/);
        if (m) {
          try {
            const parsed = JSON.parse(m[0]);
            suggestions = Array.isArray(parsed) ? parsed : [];
          } catch {
            suggestions = [];
          }
        }
      }

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        suggestions = [
          'For {{student_first}}, a next step is {{next_step}}.',
          '{{he_she}} is showing growth in {{subject}}; continue practicing regularly.',
          'Consider providing evidence to support ideas more clearly.',
          'Great engagement—keep building stamina during independent work.',
          'Next: apply strategies independently to new tasks.',
        ];
      }
      return { suggestions: suggestions.slice(0, 5) };
    }

    // Fallback (no OPENAI_API_KEY)
    return {
      suggestions: [
        '{{student_first}} has shown increased confidence recently.',
        'A helpful next step is {{next_step}}.',
        '{{he_she}} benefits from focused practice in this area.',
        'Keep celebrating small wins to build momentum.',
        'Try applying these strategies during independent work.',
      ],
    };
  }
}