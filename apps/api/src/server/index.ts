// apps/api/src/server/index.ts
import express from 'express';
import cors from 'cors';
import {
  getCommentSuggestions,
  getSkillsSummary,
  ALLOWED_SKILLS,
  ALLOWED_LEVELS,
} from '../lib/comments';

const app = express();
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// GET /comments?skill=collaboration&level=G
app.get('/comments', async (req, res) => {
  try {
    const skill = String(req.query.skill || '').trim();
    const levelRaw = (req.query.level ?? '').toString().trim();
    const level = levelRaw === '' ? undefined : levelRaw;

    const data = await getCommentSuggestions(skill, level);
    res.json({ data, skill, level });
  } catch (err: any) {
    res.status(400).json({
      error: err?.message ?? 'Unknown error',
      validSkills: Array.from(ALLOWED_SKILLS),
      validLevels: Array.from(ALLOWED_LEVELS),
    });
  }
});

// ✅ Missing before: summary endpoint
app.get('/comments/summary', async (_req, res) => {
  try {
    const summary = await getSkillsSummary();
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
});

// 404 handler (optional)
app.use((_req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});