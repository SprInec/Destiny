import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { calculateBazi } from '@destiny/core';
import tz from 'moment-timezone';
import { Lunar } from 'lunar-javascript';

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

const BaziRequestSchema = z.object({
  datetime: z.string(),
  timezone: z.string().default('Asia/Shanghai'),
  calendar: z.enum(['gregorian', 'lunar']).default('gregorian'),
  gender: z.enum(['male', 'female']).optional(),
  location: z
    .object({
      lat: z.number(),
      lon: z.number()
    })
    .optional()
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', t: Date.now() });
});

app.post('/api/bazi', (req, res) => {
  const parse = BaziRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  try {
    console.log('[POST /api/bazi]', parse.data);
    const result = calculateBazi(parse.data);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Internal Error' });
  }
});

app.post('/api/convert', (req, res) => {
  const body = req.body as { datetime: string; timezone?: string; to?: 'lunar'|'gregorian' };
  try {
    const timezone = body.timezone || 'Asia/Shanghai';
    const m = tz.tz(body.datetime, timezone);
    const lunar = Lunar.fromDate(m.toDate());
    if (body.to === 'lunar') {
      return res.json({
        lunar: {
          ymd: `${lunar.getYear()}-${lunar.getMonth()}-${lunar.getDay()}`,
          monthName: lunar.getMonthInChinese(),
          dayName: lunar.getDayInChinese(),
          jieQi: lunar.getJieQi()
        }
      });
    }
    const solar2 = lunar.getSolar();
    res.json({
      solar: {
        ymd: `${solar2.getYear()}-${solar2.getMonth()}-${solar2.getDay()}`,
        hms: `${solar2.getHour()}:${solar2.getMinute()}:${solar2.getSecond()}`
      }
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'convert error' });
  }
});

// Simple timeline API for liu nian / liu yue preview
app.get('/api/timeline/:year', (req, res) => {
  const y = parseInt(req.params.year, 10);
  if (Number.isNaN(y)) return res.status(400).json({ error: 'invalid year' });
  // 60甲子滚动：年干支
  const start = Lunar.fromDate(new Date(y, 0, 1));
  const timezone = 'Asia/Shanghai';
  const list = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date(Date.UTC(y, i, 1, 0, 0, 0));
    const payload = { datetime: d.toISOString(), timezone } as const;
    const r = calculateBazi(payload);
    return { month: i + 1, pillar: `${r.month.heavenlyStem}${r.month.earthlyBranch}` };
  });
  res.json({ year: y, months: list });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`destiny-api listening on :${port}`);
});


