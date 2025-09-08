import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth';

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: ['http://localhost:3000'], // your Next.js dev server
    credentials: true,                 // allow cookies
  })
);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Mount auth
app.use('/auth', authRouter);

// You likely have other routes:
// app.use('/students', studentsRouter);
// app.use('/classes', classesRouter);
// ...

const port = parseInt(process.env.PORT || '4000', 10);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});