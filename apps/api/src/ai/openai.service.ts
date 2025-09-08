import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private client: OpenAI | null = null;
  private log = new Logger(OpenAIService.name);

  private getClient() {
    if (!this.client) {
      const key = process.env.OPENAI_API_KEY || '';
      if (!key) {
        this.log.warn('OPENAI_API_KEY missing; AI fallbacks will be used.');
        return null;
      }
      this.client = new OpenAI({ apiKey: key });
    }
    return this.client;
  }

  /**
   * Calls OpenAI and tries to coerce valid JSON. If anything fails, return fallback.
   */
  async json<T>(prompt: string, fallback: T): Promise<T> {
    const client = this.getClient();
    if (!client) return fallback;

    try {
      const res = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You output valid JSON only. No prose. No markdown.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' as const },
      });

      const raw = res.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(raw);
      return parsed as T;
    } catch (e) {
      this.log.error(`AI JSON parse error: ${String(e)}`);
      return fallback;
    }
  }
}