import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

type GenBody = {
  subject?: string;
  gradeBand?: string;
  skillIds?: string[];
  tone?: 'positive' | 'formal' | 'growth' | 'concise';
  length?: 'short' | 'medium' | 'long';
  placeholders?: string[];
};

@Controller('comments/generate')
@UseGuards(JwtGuard)
export class CommentGenerateController {
  private openai?: OpenAI;

  constructor(private prisma: PrismaService) {
    const key = process.env.OPENAI_API_KEY;
    if (key) this.openai = new OpenAI({ apiKey: key });
  }

  @Post()
  async generate(@Req() _req: any, @Body() body: GenBody) {
    const skills = body.skillIds?.length
      ? await this.prisma.standardSkill.findMany({ where: { id: { in: body.skillIds } } })
      : [];

    const tone = body.tone || 'positive';
    const length = body.length || 'medium';
    const skillText = skills
      .map((s) => `${s.code ? s.code + ' ' : ''}${s.label}${s.category ? ` (${s.category})` : ''}`)
      .join('; ');

    const modeHint = body.subject ? 'Subject Standards' : 'Elementary Learning Skills';
    const ctx = [
      `Mode: ${modeHint}`,
      body.subject ? `Subject: ${body.subject}` : null,
      body.gradeBand ? `Grade band: ${body.gradeBand}` : null,
      skillText ? `Skills: ${skillText}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (this.openai) {
      const sys =
        `You write K-12 teacher comments. Be teacher-appropriate and parent-friendly.\n` +
        `Use placeholders literally where appropriate (do not replace): {{student_first}}, {{he_she}}, {{subject}}, {{next_step}}, etc.\n` +
        `Write 1 paragraph only.`;
      const user = `Context:\n${ctx}\n\nTone=${tone}, Length=${length}.\nGenerate the comment.`;

      const r = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        temperature: 0.4,
      });

      const text = r.choices?.[0]?.message?.content?.trim() || '';
      return { text };
    }

    // Fallback (no OPENAI_API_KEY)
    const lead =
      tone === 'growth'
        ? `{{student_first}} is making steady progress${body.subject ? ` in {{subject}}` : ''}.`
        : tone === 'formal'
          ? `{{student_first}} demonstrates performance${body.subject ? ` in {{subject}}` : ''} aligned with grade expectations.`
          : `{{student_first}} shows positive engagement${body.subject ? ` in {{subject}}` : ''}.`;

    const skillBits = skills.length ? ` Focus areas include ${skills.map((s) => s.label.toLowerCase()).join(', ')}.` : '';
    const next = ` Next step: {{next_step}}.`;
    const wrap =
      length === 'long'
        ? ` ${tone === 'positive' ? 'Keep up the great work!' : 'With continued support, growth will continue.'}`
        : '';

    return { text: `${lead}${skillBits}${next}${wrap}` };
  }
}