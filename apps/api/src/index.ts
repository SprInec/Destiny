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
  datetime: z.string().optional(),
  timezone: z.string().default('Asia/Shanghai'),
  calendar: z.enum(['gregorian', 'lunar']).default('gregorian'),
  gender: z.enum(['male', 'female']).optional(),
  useTrueSolarTime: z.boolean().optional(),
  location: z
    .object({
      lat: z.number(),
      lon: z.number()
    })
    .optional(),
  lunar: z
    .object({
      year: z.number(),
      month: z.number(),
      day: z.number(),
      isLeap: z.boolean().optional(),
      hour: z.number().optional(),
      minute: z.number().optional(),
      second: z.number().optional()
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
    const body = parse.data;
    let payload: any = { ...body };
    if (body.calendar === 'lunar' && body.lunar) {
      // Convert lunar → solar ISO using timezone
      const L: any = Lunar as any;
      const hour = Number.isFinite(body.lunar.hour) ? (body.lunar.hour as number) : 0;
      const minute = Number.isFinite(body.lunar.minute) ? (body.lunar.minute as number) : 0;
      const second = Number.isFinite(body.lunar.second) ? (body.lunar.second as number) : 0;
      const isLeap = !!body.lunar.isLeap;
      const lunarObj = (typeof L.fromYmdHms === 'function')
        ? L.fromYmdHms(body.lunar.year, body.lunar.month, body.lunar.day, hour, minute, second, isLeap)
        : (typeof L.fromYmd === 'function' ? L.fromYmd(body.lunar.year, body.lunar.month, body.lunar.day, isLeap) : null);
      if (!lunarObj) throw new Error('lunar conversion unavailable');
      const solar = lunarObj.getSolar();
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const ymd = `${solar.getYear()}-${pad2(solar.getMonth())}-${pad2(solar.getDay())}`;
      const hms = `${pad2(solar.getHour())}:${pad2(solar.getMinute())}:${pad2(solar.getSecond())}`;
      const m = tz.tz(`${ymd} ${hms}`, body.timezone || 'Asia/Shanghai');
      payload.datetime = m.toISOString();
    } else if (!body.datetime) {
      return res.status(400).json({ error: 'missing datetime' });
    }
    console.log('[POST /api/bazi]', { calendar: payload.calendar, datetime: payload.datetime, timezone: payload.timezone });
    // Ensure datetime is always present for core
    if (!payload.datetime) {
      return res.status(400).json({ error: 'missing datetime' });
    }
    const result = calculateBazi({
      datetime: payload.datetime as string,
      timezone: payload.timezone,
      calendar: payload.calendar,
      gender: payload.gender,
      location: payload.location,
      useTrueSolarTime: payload.useTrueSolarTime
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Internal Error' });
  }
});

// ZiWei transit (流年/流月/流日) — 复用 calculateBazi，按输入时间返回当下盘（前端进行对照叠加）
app.post('/api/ziwei/transit', (req, res) => {
  const parse = BaziRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  try {
    const body = parse.data as any;
    let payload: any = { ...body };
    if (body.calendar === 'lunar' && body.lunar) {
      const L: any = Lunar as any;
      const hour = Number.isFinite(body.lunar.hour) ? (body.lunar.hour as number) : 0;
      const minute = Number.isFinite(body.lunar.minute) ? (body.lunar.minute as number) : 0;
      const second = Number.isFinite(body.lunar.second) ? (body.lunar.second as number) : 0;
      const isLeap = !!body.lunar.isLeap;
      const lunarObj = (typeof L.fromYmdHms === 'function')
        ? L.fromYmdHms(body.lunar.year, body.lunar.month, body.lunar.day, hour, minute, second, isLeap)
        : (typeof L.fromYmd === 'function' ? L.fromYmd(body.lunar.year, body.lunar.month, body.lunar.day, isLeap) : null);
      if (!lunarObj) throw new Error('lunar conversion unavailable');
      const solar = lunarObj.getSolar();
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const ymd = `${solar.getYear()}-${pad2(solar.getMonth())}-${pad2(solar.getDay())}`;
      const hms = `${pad2(solar.getHour())}:${pad2(solar.getMinute())}:${pad2(solar.getSecond())}`;
      const m = tz.tz(`${ymd} ${hms}`, body.timezone || 'Asia/Shanghai');
      payload.datetime = m.toISOString();
    }
    if (!payload.datetime) {
      return res.status(400).json({ error: 'missing datetime' });
    }
    const result = calculateBazi({
      datetime: payload.datetime,
      timezone: payload.timezone,
      calendar: payload.calendar,
      gender: payload.gender,
      location: payload.location,
      useTrueSolarTime: payload.useTrueSolarTime
    });
    res.json({
      base: result.ziwei,
      pillars: {
        year: result.year, month: result.month, day: result.day, hour: result.hour
      }
    });
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
          year: lunar.getYear(),
          month: lunar.getMonth(),
          day: lunar.getDay(),
          isLeap: (lunar as any).isLeap ? Boolean((lunar as any).isLeap()) : false,
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

// Convert a lunar date input to ISO datetime in the given timezone
// Body: { lunar: { year, month, day, isLeap?, hour?, minute?, second? }, timezone?: string }
app.post('/api/convert-lunar', (req, res) => {
  try {
    const body = req.body as {
      lunar: { year: number; month: number; day: number; isLeap?: boolean; hour?: number; minute?: number; second?: number };
      timezone?: string;
    };
    if (!body || !body.lunar) return res.status(400).json({ error: 'missing lunar' });
    const { year, month, day } = body.lunar;
    if (!year || !month || !day) return res.status(400).json({ error: 'invalid lunar y/m/d' });
    const h = Number.isFinite(body.lunar.hour) ? Number(body.lunar.hour) : 0;
    const mi = Number.isFinite(body.lunar.minute) ? Number(body.lunar.minute) : 0;
    const s = Number.isFinite(body.lunar.second) ? Number(body.lunar.second) : 0;
    const isLeap = !!body.lunar.isLeap;
    // lunar-javascript supports fromYmdHms(year, month, day, hour, minute, second, isLeapMonth)
    const L: any = Lunar as any;
    const lunarObj = (typeof L.fromYmdHms === 'function')
      ? L.fromYmdHms(year, month, day, h, mi, s, isLeap)
      : (typeof L.fromYmd === 'function' ? L.fromYmd(year, month, day, isLeap) : null);
    if (!lunarObj) return res.status(400).json({ error: 'conversion unavailable' });
    const solar = lunarObj.getSolar();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const tzName = body.timezone || 'Asia/Shanghai';
    const ymd = `${solar.getYear()}-${pad2(solar.getMonth())}-${pad2(solar.getDay())}`;
    const hms = `${pad2(solar.getHour())}:${pad2(solar.getMinute())}:${pad2(solar.getSecond())}`;
    const m = tz.tz(`${ymd} ${hms}`, tzName);
    return res.json({ iso: m.toISOString() });
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'convert lunar error' });
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


