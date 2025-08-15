import dayjs from 'dayjs';
import tz from 'moment-timezone';
import { Lunar, EightChar } from 'lunar-javascript';
import { NAYIN_MAP as NAYIN_TABLE, getNaYin as getNaYinFromFile } from './data/nayin';
import { SHENSHA_RULES, ShenShaRule, toArr } from './data/shensha';

export type BaziInput = {
  datetime: string; // ISO or yyyy-MM-ddTHH:mm
  timezone?: string; // IANA tz
  calendar?: 'gregorian' | 'lunar';
  gender?: 'male' | 'female';
  location?: { lat: number; lon: number };
  useTrueSolarTime?: boolean;
};

export type Pillar = {
  heavenlyStem: string;
  earthlyBranch: string;
  hiddenStems: string[];
  naYin: string;
};

export type FiveElementPower = {
  wood: number;
  fire: number;
  earth: number;
  metal: number;
  water: number;
};

export type DaYun = {
  startAge: number;
  startYear: number;
  pillar: string; // stem+branch
};

export type LiuNian = {
  year: number;
  pillar: string;
};

export type BaziResult = {
  input: BaziInput & { normalizedISO: string };
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
  emptyBranches: string[]; // 保留兼容性，主要用日柱空亡
  xunKong: { year: string[]; month: string[]; day: string[]; hour: string[] }; // 各柱空亡详情
  fiveElementPower: FiveElementPower;
  tenGods: { year: string; month: string; day: string; hour: string };
  luckCycles: { daYun: DaYun[]; liuNian: LiuNian[] };
  advice: {
    dayMaster: { stem: string; element: keyof FiveElementPower };
    strength: 'weak' | 'balanced' | 'strong';
    favorable: (keyof FiveElementPower)[];
    avoid: (keyof FiveElementPower)[];
    notes: string;
  };
  graph: {
    nodes: { id: string; label: string; kind: 'stem'|'branch'; element: keyof FiveElementPower }[];
    edges: { source: string; target: string; relation: '生'|'克'|'同'; weight: number }[];
  };
  branchGraph: {
    nodes: { id: string; label: string; kind: 'branch'; element: keyof FiveElementPower }[];
    edges: { source: string; target: string; relation: string; weight: number }[];
  };
  stars: { name: string; hits: string[] }[];
  tenGodsDetail: {
    year: { stem: string; relation: string }[];
    month: { stem: string; relation: string }[];
    day: { stem: string; relation: string }[];
    hour: { stem: string; relation: string }[];
  };
  tenGodsStrength: Record<string,'strong'|'medium'|'weak'>;
  correction?: { minutes: number; eot: number; longitude: number };
  ziwei?: { 
    palaces: { key: string; name: string; branch: string; stars: { name: string; type: 'main'|'assist'|'transform'|'misc' }[] }[];
    meta?: { triSquares: number[][] };
  };
};

const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

function composePillar(stemIndex: number, branchIndex: number) {
  const stem = STEMS[(stemIndex+60)%10];
  const branch = BRANCHES[(branchIndex+60)%12];
  return `${stem}${branch}`;
}

// no-op placeholder for future true solar time adjustments by location
function toLocalizedDate(datetimeISO: string, timezone: string): Date {
  const m = tz.tz(datetimeISO, timezone);
  return m.toDate();
}

function toTrueSolarDate(datetimeISO: string, timezone: string, location?: { lat:number; lon:number }, enabled?: boolean): Date {
  const m = tz.tz(datetimeISO, timezone);
  if (!enabled || !location) return m.toDate();
  const offsetMin = m.utcOffset();
  const zoneCenterLon = (offsetMin / 60) * 15; // 15° per hour
  const deltaLon = (location.lon ?? 0) - zoneCenterLon; // degrees
  const eot = equationOfTimeMinutes(m.toDate());
  const deltaMinutes = deltaLon * 4; // approx 4 minutes per degree
  const m2 = m.clone().add(deltaMinutes + eot, 'minute');
  return m2.toDate();
}

// Approximate Equation of Time in minutes (Meeus simplified)
function equationOfTimeMinutes(date: Date): number {
  const day1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = (date.getTime() - day1.getTime());
  const n = Math.floor(diff / (24 * 60 * 60 * 1000)); // day of year
  const B = (2 * Math.PI * (n - 81)) / 364; // radians
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
  return eot;
}

function getHiddenStemsOfBranch(branch: string): string[] {
  const map: Record<string,string[]> = {
    '子': ['癸'],
    '丑': ['己','癸','辛'],
    '寅': ['甲','丙','戊'],
    '卯': ['乙'],
    '辰': ['戊','乙','癸'],
    '巳': ['丙','戊','庚'],
    '午': ['丁','己'],
    '未': ['己','乙','丁'],
    '申': ['庚','壬','戊'],
    '酉': ['辛'],
    '戌': ['戊','辛','丁'],
    '亥': ['壬','甲']
  };
  return map[branch] || [];
}

function getNaYin(stem: string, branch: string): string { return getNaYinFromFile(stem, branch); }

type Element = keyof FiveElementPower;

function elementOfStem(stem: string): Element {
  if (stem==='甲' || stem==='乙') return 'wood';
  if (stem==='丙' || stem==='丁') return 'fire';
  if (stem==='戊' || stem==='己') return 'earth';
  if (stem==='庚' || stem==='辛') return 'metal';
  return 'water';
}

function yinYangOfStem(stem: string): 'yang'|'yin' {
  // 甲丙戊庚壬为阳，乙丁己辛癸为阴
  return ['甲','丙','戊','庚','壬'].includes(stem) ? 'yang' : 'yin';
}

function tenGodRelative(dayStem: string, otherStem: string): string {
  const dayEl = elementOfStem(dayStem);
  const otherEl = elementOfStem(otherStem);
  const samePolarity = yinYangOfStem(dayStem) === yinYangOfStem(otherStem);
  if (dayEl === otherEl) return samePolarity ? '比肩' : '劫财';
  // 我生
  if (elementGeneratedBy(dayEl) === otherEl) return samePolarity ? '食神' : '伤官';
  // 我克（对方为财）
  if (elementThatControls(otherEl) === dayEl) return samePolarity ? '正财' : '偏财';
  // 克我（对方为官杀）
  if (elementThatControls(dayEl) === otherEl) return samePolarity ? '正官' : '七杀';
  // 生我（对方为印）
  if (elementGeneratedBy(otherEl) === dayEl) return samePolarity ? '正印' : '偏印';
  return '';
}

function elementOfBranch(branch: string): Element {
  switch (branch) {
    case '寅': case '卯': return 'wood';
    case '巳': case '午': return 'fire';
    case '申': case '酉': return 'metal';
    case '亥': case '子': return 'water';
    default: return 'earth'; // 丑辰未戌
  }
}

function monthBranchFromPillar(pillar: string): string { return pillar[1]; }
function scoreTenGod(relation: string, monthBranch: string, hiddenInPillars: string[][], exposedStems: string[]): number {
  // base scores by relation group
  const baseMap: Record<string,number> = { '比肩':1, '劫财':0.9, '食神':0.9, '伤官':0.8, '正财':0.8, '偏财':0.8, '正官':0.85, '七杀':0.8, '正印':0.9, '偏印':0.85 };
  let score = baseMap[relation] ?? 0.8;
  // 得令：月支五行与此十神的五行一致，则加权
  const relElement = ((): Element => {
    const inv: Record<string,Element> = {
      '比肩':'wood','劫财':'wood','食神':'fire','伤官':'fire','正财':'earth','偏财':'earth','正官':'metal','七杀':'metal','正印':'water','偏印':'water'
    } as any; return inv[relation] || 'earth'; })();
  if (elementOfBranch(monthBranch) === relElement) score += 0.2;
  // 通根：四柱藏干中出现同类，稍增
  const flatHidden = hiddenInPillars.flat();
  const relByStem = (s:string)=> tenGodRelative(s, s); // trick to map to group by stem element
  if (flatHidden.some(h => tenGodRelative(h, h) && elementOfStem(h)===relElement)) score += 0.1;
  // 透出：其他天干直接透出与此十神同类
  if (exposedStems.some(s => elementOfStem(s)===relElement)) score += 0.1;
  return score;
}

function elementThatGenerates(target: Element): Element {
  // 生我：金生水，土生金，火生土，木生火，水生木
  switch (target) {
    case 'wood': return 'water';
    case 'fire': return 'wood';
    case 'earth': return 'fire';
    case 'metal': return 'earth';
    case 'water': return 'metal';
  }
}

function elementGeneratedBy(source: Element): Element {
  // 我生：木生火，火生土，土生金，金生水，水生木
  switch (source) {
    case 'wood': return 'fire';
    case 'fire': return 'earth';
    case 'earth': return 'metal';
    case 'metal': return 'water';
    case 'water': return 'wood';
  }
}

function elementThatControls(target: Element): Element {
  // 克我：金克木，木克土，土克水，水克火，火克金
  switch (target) {
    case 'wood': return 'metal';
    case 'fire': return 'water';
    case 'earth': return 'wood';
    case 'metal': return 'fire';
    case 'water': return 'earth';
  }
}

// ===== ZiWei DouShu — 12 palaces (simplified, production-grade base) =====
type ZiweiStarType = 'main'|'assist'|'transform'|'misc'
type ZiweiPalace = { key: string; name: string; branch: string; stars: { name: string; type: ZiweiStarType }[] }

function calculateZiweiPalacesCore(lunar: Lunar, yearPillar: string, monthPillar: string, dayPillar: string, hourPillar: string): ZiweiPalace[] {
  const PALACE_ORDER: { key: string; name: string }[] = [
    { key:'m', name:'命宫' },{ key:'xb', name:'兄弟' },{ key:'fp', name:'夫妻' },{ key:'zn', name:'子女' },
    { key:'cb', name:'财帛' },{ key:'je', name:'疾厄' },{ key:'qy', name:'迁移' },{ key:'py', name:'仆役' },
    { key:'gl', name:'官禄' },{ key:'tz', name:'田宅' },{ key:'fd', name:'福德' },{ key:'fm', name:'父母' }
  ]
  // 寅起顺行 12 宫定位
  const ZW_BRANCH_RING = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑']
  const mRaw = Number((lunar as any).getMonth?.() ?? (new Date().getMonth() + 1))
  const lunarMonth = Number.isFinite(mRaw) ? Math.max(1, Math.min(12, Math.floor(mRaw))) : 1 // 1..12
  const hourBranch = String(hourPillar?.[1] || '')
  const inRingIdx = ZW_BRANCH_RING.indexOf(hourBranch)
  const inStdIdx = BRANCHES.indexOf(hourBranch)
  const hourIdx = inRingIdx >= 0 ? inRingIdx : (inStdIdx >= 0 ? inStdIdx : 0)
  // 命宫公式：从寅起 1 宫，按 (月数 + 时序数 - 1) 定位（归一化到 0..11）
  const mingOffset = ((lunarMonth + (hourIdx + 1) - 1) % 12 + 12) % 12
  // 身宫：从命宫起，按时序数定位（归一化）
  const shenOffset = ((mingOffset + (hourIdx + 1) - 1) % 12 + 12) % 12
  const res: ZiweiPalace[] = PALACE_ORDER.map((p, i) => ({ key: p.key, name: p.name, branch: ZW_BRANCH_RING[((mingOffset + i) % 12 + 12) % 12], stars: [] }))

  // 14 主星（完整顺序）：紫微、天机、太阳、武曲、天同、廉贞、天府、太阴、贪狼、巨门、天相、天梁、七杀、破军
  const MAIN_STARS = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军']
  // 宫位容器（按当前环序）
  const rotated: ZiweiPalace[] = res.map(p => ({ ...p, stars: [] }))
  for (let i = 0; i < 12; i += 1) {
    if (!rotated[i]) {
      const base = PALACE_ORDER[i] || { key: `p${i}`, name: '' }
      rotated[i] = { key: base.key, name: base.name, branch: ZW_BRANCH_RING[((mingOffset + i) % 12 + 12) % 12], stars: [] }
    } else if (!Array.isArray(rotated[i].stars)) {
      rotated[i].stars = []
    }
  }
  // 更严谨的主星安置锚点：以“月 + 日 + 时序”归一化作为紫微锚点，余星依次顺行
  const dRaw = Number((lunar as any).getDay?.() ?? (new Date().getDate()))
  const lunarDay = Number.isFinite(dRaw) ? Math.max(1, Math.min(30, Math.floor(dRaw))) : 1 // 1..30
  const ziweiAnchor = ((lunarMonth + lunarDay + (hourIdx + 1) - 1) % 12 + 12) % 12
  for (let i = 0; i < MAIN_STARS.length; i += 1) {
    const idx = ((ziweiAnchor + i) % 12 + 12) % 12
    rotated[idx].stars.push({ name: MAIN_STARS[i], type: 'main' })
  }

  // 四化（年干定）：将化禄/化权/化科/化忌标记到对应主星所在宫
  const yearStem = yearPillar[0]
  const transforms: Record<string, { lu:string; quan:string; ke:string; ji:string }> = {
    '甲':{ lu:'廉贞', quan:'破军', ke:'武曲', ji:'太阳' },
    '乙':{ lu:'天机', quan:'天梁', ke:'紫微', ji:'太阴' },
    '丙':{ lu:'天同', quan:'天机', ke:'文昌', ji:'廉贞' },
    '丁':{ lu:'太阴', quan:'天同', ke:'天机', ji:'巨门' },
    '戊':{ lu:'贪狼', quan:'太阴', ke:'右弼', ji:'天机' },
    '己':{ lu:'武曲', quan:'贪狼', ke:'天梁', ji:'文曲' },
    '庚':{ lu:'太阳', quan:'武曲', ke:'太阴', ji:'天同' },
    '辛':{ lu:'巨门', quan:'太阳', ke:'文曲', ji:'文昌' },
    '壬':{ lu:'天梁', quan:'紫微', ke:'左辅', ji:'武曲' },
    '癸':{ lu:'破军', quan:'巨门', ke:'禄存', ji:'廉贞' }
  }
  const tf = transforms[yearStem]
  if (tf) {
    const placeTransform = (starName: string, label: string) => {
      const idx = rotated.findIndex(p => Array.isArray(p?.stars) && p.stars.some(s => s.name === starName && s.type==='main'))
      const safeIdx = idx >= 0 ? idx : 0
      if (Array.isArray(rotated[safeIdx]?.stars)) rotated[safeIdx].stars.push({ name: label, type: 'transform' })
    }
    placeTransform(tf.lu, '化禄')
    placeTransform(tf.quan, '化权')
    placeTransform(tf.ke, '化科')
    placeTransform(tf.ji, '化忌')
  }

  // 辅星（初版简化）：按日干分布 文昌 / 禄存、天魁/天钺（以天乙贵人表近似），左辅右弼、文曲、地空地劫
  const dayStemZW = dayPillar[0]
  // 文昌（按日干映射到支）
  const wenchangBranches = wenChangByDayStem(dayStemZW)
  wenchangBranches.forEach(b => {
    const idx = rotated.findIndex(p => p.branch === b)
    const safeIdx = idx >= 0 ? idx : 0
    rotated[safeIdx].stars.push({ name: '文昌', type: 'assist' })
  })
  // 文曲（按年干变换近似：辛、癸偏重于金水 → 配文曲在禄存对宫，简化）
  const wcOpp = (b: string): string => BRANCHES[(BRANCHES.indexOf(b)+6)%12]
  if (['辛','癸'].includes(yearPillar[0])) {
    wenchangBranches.forEach(b => {
      const opp = wcOpp(b)
      const i = rotated.findIndex(p => p.branch === opp)
      rotated[(i>=0?i:0)].stars.push({ name: '文曲', type: 'assist' })
    })
  }
  // 禄存（用禄神映射近似处理）
  const luchunBranches = luShenByDayStem(dayStemZW)
  luchunBranches.forEach(b => {
    const idx = rotated.findIndex(p => p.branch === b)
    const safeIdx = idx >= 0 ? idx : 0
    rotated[safeIdx].stars.push({ name: '禄存', type: 'assist' })
  })
  // 天魁 / 天钺（用天乙贵人支近似分配在两处）
  const tianYi = tianYiBranchesByDayStem(dayStemZW)
  if (tianYi[0]) {
    const i1 = rotated.findIndex(p => p.branch === tianYi[0])
    rotated[(i1>=0?i1:0)].stars.push({ name: '天魁', type: 'assist' })
  }
  if (tianYi[1]) {
    const i2 = rotated.findIndex(p => p.branch === tianYi[1])
    rotated[(i2>=0?i2:0)].stars.push({ name: '天钺', type: 'assist' })
  }

  // 左辅右弼（简表）：按年支奇偶，左右分落相邻宫
  const yBranch = yearPillar[1]
  const yIndex = BRANCHES.indexOf(yBranch)
  if (yIndex >= 0) {
    const li = (yIndex + 1) % 12
    const ri = (yIndex + 11) % 12
    rotated[li].stars.push({ name: '左辅', type: 'assist' })
    rotated[ri].stars.push({ name: '右弼', type: 'assist' })
  }
  // 地空地劫（简表）：按日支映射对冲两宫
  const dBranch = dayPillar[1]
  const dIdx = BRANCHES.indexOf(dBranch)
  if (dIdx >= 0) {
    rotated[(dIdx+3)%12].stars.push({ name: '地空', type: 'assist' })
    rotated[(dIdx+9)%12].stars.push({ name: '地劫', type: 'assist' })
  }

  // 身宫标记
  const shenTarget = rotated[((shenOffset % 12) + 12) % 12] || rotated[0]
  if (shenTarget && Array.isArray(shenTarget.stars)) shenTarget.stars.push({ name:'身宫', type:'misc' })

  // 为前端网格提供环序（0..11 对应 UI 从左上顺时针的 12 格）
  const ringPalaces: ZiweiPalace[] = new Array(12).fill(null as any)
  for (let i=0;i<12;i+=1) {
    const br = ZW_BRANCH_RING[i]
    const k = rotated.findIndex(p => p.branch === br)
    ringPalaces[i] = k>=0 ? rotated[k] : rotated[i] || rotated[0]
  }
  return ringPalaces
}

// --- Simple ShenSha helpers (simplified reference tables) ---
function sanHeGroup(branch: string): '申子辰'|'寅午戌'|'巳酉丑'|'亥卯未'|null {
  if (['申','子','辰'].includes(branch)) return '申子辰';
  if (['寅','午','戌'].includes(branch)) return '寅午戌';
  if (['巳','酉','丑'].includes(branch)) return '巳酉丑';
  if (['亥','卯','未'].includes(branch)) return '亥卯未';
  return null;
}
function starBranchByGroup(group: ReturnType<typeof sanHeGroup>, star: '桃花'|'驿马'|'华盖'): string | null {
  if (!group) return null;
  const map: Record<string, Record<string, string>> = {
    '申子辰': { '桃花':'酉', '驿马':'寅', '华盖':'辰' },
    '寅午戌': { '桃花':'卯', '驿马':'申', '华盖':'戌' },
    '巳酉丑': { '桃花':'午', '驿马':'亥', '华盖':'丑' },
    '亥卯未': { '桃花':'子', '驿马':'巳', '华盖':'未' }
  };
  return map[group]?.[star] ?? null;
}
function tianYiBranchesByDayStem(stem: string): string[] {
  const map: Record<string, string[]> = {
    '甲': ['丑','未'], '戊': ['丑','未'], '庚': ['丑','未'],
    '乙': ['子','申'], '己': ['子','申'],
    '丙': ['亥','酉'], '丁': ['亥','酉'],
    '辛': ['寅','午'],
    '壬': ['卯','巳'], '癸': ['卯','巳']
  };
  return map[stem] || [];
}
function wenChangByDayStem(stem: string): string[] {
  const map: Record<string, string[]> = {
    '甲': ['巳'], '乙': ['午'], '丙': ['申'], '丁': ['酉'],
    '戊': ['申'], '己': ['酉'], '庚': ['亥'], '辛': ['子'],
    '壬': ['寅'], '癸': ['卯']
  };
  return map[stem] || [];
}

// 太极贵人：通用表（按日干取两支）
function taiJiByDayStem(stem: string): string[] {
  const map: Record<string, string[]> = {
    '甲': ['子','午'], '乙': ['子','午'],
    '丙': ['卯','酉'], '丁': ['卯','酉'],
    '戊': ['辰','戌'],
    '己': ['巳','亥'],
    '庚': ['丑','未'], '辛': ['丑','未'],
    '壬': ['寅','申'], '癸': ['寅','申']
  };
  return map[stem] || [];
}

// 金舆：通用表（按日干定支）
function jinYuByDayStem(stem: string): string[] {
  const map: Record<string,string> = {
    '甲':'未','乙':'申','丙':'酉','丁':'戌','戊':'酉','己':'戌','庚':'亥','辛':'子','壬':'丑','癸':'寅'
  };
  return map[stem] ? [map[stem]] : [];
}

// 天医：通用表（按日支定）
function tianYiByDayBranch(branch: string): string[] {
  const map: Record<string,string> = {
    '子':'未','丑':'申','寅':'酉','卯':'戌','辰':'亥','巳':'子',
    '午':'丑','未':'寅','申':'卯','酉':'辰','戌':'巳','亥':'午'
  };
  return map[branch] ? [map[branch]] : [];
}
// 禄神：各日主禄位（简表）
function luShenByDayStem(stem: string): string[] {
  const map: Record<string,string> = {
    '甲':'寅','乙':'卯','丙':'巳','丁':'午','戊':'巳','己':'午','庚':'申','辛':'酉','壬':'亥','癸':'子'
  };
  return map[stem] ? [map[stem]] : [];
}
// 孤辰寡宿（年支定宫，示意简表）
function guChenByYearBranch(branch: string): string[] {
  const map: Record<string,string> = {
    '子':'寅','丑':'卯','寅':'辰','卯':'巳','辰':'午','巳':'未','午':'申','未':'酉','申':'戌','酉':'亥','戌':'子','亥':'丑'
  };
  return map[branch] ? [map[branch]] : [];
}
function guaSuByYearBranch(branch: string): string[] {
  const map: Record<string,string> = {
    '子':'戌','丑':'亥','寅':'子','卯':'丑','辰':'寅','巳':'卯','午':'辰','未':'巳','申':'午','酉':'未','戌':'申','亥':'酉'
  };
  return map[branch] ? [map[branch]] : [];
}
// 咸池=桃花（以年支定，示意同名归一）
function xianChiByYearBranch(branch: string): string[] {
  const map: Record<string,string> = {
    '申':'酉','子':'酉','辰':'酉',
    '寅':'卯','午':'卯','戌':'卯',
    '巳':'午','酉':'午','丑':'午',
    '亥':'子','卯':'子','未':'子'
  };
  return map[branch] ? [map[branch]] : [];
}
function yangRenByDayStem(stem: string): string[] {
  const map: Record<string,string> = {
    '甲':'卯','乙':'辰','丙':'午','丁':'未','戊':'午','己':'未','庚':'酉','辛':'戌','壬':'子','癸':'丑'
  };
  return map[stem] ? [map[stem]] : [];
}
function hongLuanByYearBranch(branch: string): string[] {
  const map: Record<string,string> = {
    '子':'卯','丑':'寅','寅':'丑','卯':'子','辰':'亥','巳':'戌','午':'酉','未':'申','申':'未','酉':'午','戌':'巳','亥':'辰'
  };
  return map[branch] ? [map[branch]] : [];
}
function tianXiByYearBranch(branch: string): string[] {
  const map: Record<string,string> = {
    '子':'辰','丑':'卯','寅':'寅','卯':'丑','辰':'子','巳':'亥','午':'戌','未':'酉','申':'申','酉':'未','戌':'午','亥':'巳'
  };
  return map[branch] ? [map[branch]] : [];
}
function computeStars(dayStem: string, dayBranch: string, monthBranch: string, yearBranch: string, pillars: { branch:string }[], monthNumber?: number, dayPillar?: string) {
  const labels = ['年','月','日','时'];
  const results: { name: string; hits: string[]; group?: string }[] = [];
  const group = sanHeGroup(dayBranch);
  const collect = (name:string, positions:string[], groupOverride?: string) => {
    positions.forEach(pos => {
      const hits = pillars.map((p,i)=> ({p,i})).filter(x=>x.p.branch===pos).map(x=>labels[x.i]);
      if (hits.length) {
        const grp = groupOverride || (['天乙贵人','文昌','太极贵人','天医'].includes(name) ? '贵人' : (['羊刃','孤辰','寡宿'].includes(name) ? '煞曜' : '吉曜'));
        results.push({ name, hits, group: grp });
      }
    });
  };
  
  // 获取季节信息用于四废、四忌等
  const getSeason = (month: number): string => {
    if (month >= 2 && month <= 4) return '春';
    if (month >= 5 && month <= 7) return '夏';
    if (month >= 8 && month <= 10) return '秋';
    return '冬';
  };
  
  SHENSHA_RULES.forEach((rule: ShenShaRule) => {
    const map = rule.map || {};
    let positions: string[] = [];
    
    switch (rule.mode) {
      case 'sanHe':
        const pos = starBranchByGroup(group, rule.name as any);
        if (pos) collect(rule.name, [pos], rule.group);
        break;
        
      case 'byDayStemMap':
        positions = toArr(map[dayStem] as any) as string[];
        break;
        
      case 'byDayBranchMap':
        positions = toArr(map[dayBranch] as any) as string[];
        break;
        
      case 'byYearBranchMap':
        positions = toArr(map[yearBranch] as any) as string[];
        break;
        
      case 'byMonthBranchMap':
        positions = toArr(map[monthBranch] as any) as string[];
        break;
        
      case 'byMonthMap':
        if (monthNumber) {
          positions = toArr(map[monthNumber.toString()] as any) as string[];
        }
        break;
        
      case 'bySpecialDayPillar':
        if (dayPillar && rule.specialPillars?.includes(dayPillar)) {
          // 特殊日柱神煞，如果命中则在日柱显示
          results.push({ name: rule.name, hits: ['日'], group: rule.group });
        }
        break;
        
      case 'bySeasonMap':
        if (monthNumber && rule.seasonMap) {
          const season = getSeason(monthNumber);
          const seasonPillars = rule.seasonMap[season] || [];
          if (dayPillar && seasonPillars.includes(dayPillar)) {
            results.push({ name: rule.name, hits: ['日'], group: rule.group });
          }
        }
        break;
        
      case 'sixConflict':
      case 'sixHarm':
      case 'threeClash':
        if (rule.relations) {
          const branches = pillars.map(p => p.branch);
          rule.relations.forEach(rel => {
            const fromIdx = branches.indexOf(rel.from);
            const toIdx = branches.indexOf(rel.to);
            if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
              const hitLabels = [labels[fromIdx], labels[toIdx]];
              results.push({ name: rule.name, hits: hitLabels, group: rule.group });
            }
          });
        }
        break;
        
      case 'selfClash':
        Object.entries(map).forEach(([branch, target]) => {
          const indices = pillars.map((p, i) => p.branch === branch ? i : -1).filter(i => i >= 0);
          if (indices.length >= 2) {
            // 同一地支出现两次或以上才算自刑
            const hitLabels = indices.map(i => labels[i]);
            results.push({ name: rule.name, hits: hitLabels, group: rule.group });
          }
        });
        break;
    }
    
    if (positions && positions.length) {
      collect(rule.name, positions, rule.group);
    }
  });
  return results;
}

const JIA_ZI: string[] = (() => {
  const arr: string[] = [];
  for (let i=0;i<60;i+=1) {
    arr.push(STEMS[i%10] + BRANCHES[i%12]);
  }
  return arr;
})();

// 计算单个柱的空亡
function computeXunKongByPillar(pillar: string): string[] {
  const idx = JIA_ZI.indexOf(pillar);
  if (idx >= 0) {
    const start = Math.floor(idx/10)*10;
    const startPillar = JIA_ZI[start];
    const startBranch = startPillar[1];
    // 六旬空亡对应表
    const map: Record<string, string[]> = {
      '子': ['戌','亥'], // 甲子旬空戌亥
      '戌': ['申','酉'], // 甲戌旬空申酉
      '申': ['午','未'], // 甲申旬空午未
      '午': ['辰','巳'], // 甲午旬空辰巳
      '辰': ['寅','卯'], // 甲辰旬空寅卯
      '寅': ['子','丑']  // 甲寅旬空子丑
    };
    return map[startBranch] || [];
  }
  return [];
}

// 计算各柱空亡情况
function computeAllXunKong(yearPillar: string, monthPillar: string, dayPillar: string, hourPillar: string) {
  return {
    year: computeXunKongByPillar(yearPillar),
    month: computeXunKongByPillar(monthPillar),
    day: computeXunKongByPillar(dayPillar),
    hour: computeXunKongByPillar(hourPillar)
  };
}

function estimateFiveElementPower(year: string, month: string, day: string, hour: string): FiveElementPower {
  // Improved heuristic: stems +1, branches +0.7, month-branch +0.8 extra, hidden stems +0.5 each
  const acc: FiveElementPower = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const pillars = [year, month, day, hour];
  pillars.forEach((p, idx) => {
    const stem = p[0];
    const branch = p[1];
    acc[elementOfStem(stem)] += 1;
    acc[elementOfBranch(branch)] += 0.7;
    if (idx === 1) acc[elementOfBranch(branch)] += 0.8; // month令
    getHiddenStemsOfBranch(branch).forEach(h => {
      acc[elementOfStem(h)] += 0.5;
    });
  });
  return acc;
}

export function calculateBazi(input: BaziInput): BaziResult {
  const timezone = input.timezone || 'Asia/Shanghai';
  const calendar = input.calendar || 'gregorian';
  const normalizedISO = dayjs(input.datetime).toISOString();
  const localDate = toTrueSolarDate(normalizedISO, timezone, input.location, input.useTrueSolarTime);
  // compute correction meta (minutes) for UI hint
  let correction: { minutes: number; eot: number; longitude: number } | undefined = undefined;
  if (input.useTrueSolarTime && input.location) {
    const base = tz.tz(normalizedISO, timezone);
    const offsetMin = base.utcOffset();
    const zoneCenterLon = (offsetMin / 60) * 15;
    const deltaLon = (input.location.lon ?? 0) - zoneCenterLon;
    const lonMin = deltaLon * 4;
    const eot = equationOfTimeMinutes(base.toDate());
    correction = { minutes: lonMin + eot, eot, longitude: input.location.lon };
  }
  const lunar = Lunar.fromDate(localDate);
  const ec = EightChar.fromLunar(lunar);

  const yearPillar = ec.getYear();
  const monthPillar = ec.getMonth();
  const dayPillar = ec.getDay();
  const hourPillar = ec.getTime();

  const mk = (pillar: string): Pillar => {
    const stem = pillar[0];
    const branch = pillar[1];
    return {
      heavenlyStem: stem,
      earthlyBranch: branch,
      hiddenStems: getHiddenStemsOfBranch(branch),
      naYin: getNaYin(stem, branch)
    };
  };

  // 计算各柱空亡
  const xunKong = computeAllXunKong(yearPillar, monthPillar, dayPillar, hourPillar);
  
  // 保留原有的 emptyBranches 字段用于兼容性，主要使用日柱空亡
  const emptyStr = typeof (ec as any).getXunKong === 'function'
    ? (ec as any).getXunKong()
    : (typeof (lunar as any).getXunKong === 'function' ? (lunar as any).getXunKong() : '');
  const emptyBranches = (emptyStr && String(emptyStr).length > 0)
    ? String(emptyStr).split('')
    : xunKong.day;

  const fiveElementPower = estimateFiveElementPower(yearPillar, monthPillar, dayPillar, hourPillar);

  const tenGods = {
    year: tenGodRelative(dayPillar[0], yearPillar[0]) || (typeof (ec as any).getYearShiShen === 'function' ? (ec as any).getYearShiShen() : ''),
    month: tenGodRelative(dayPillar[0], monthPillar[0]) || (typeof (ec as any).getMonthShiShen === 'function' ? (ec as any).getMonthShiShen() : ''),
    day: '日主',
    hour: tenGodRelative(dayPillar[0], hourPillar[0]) || (typeof (ec as any).getTimeShiShen === 'function' ? (ec as any).getTimeShiShen() : '')
  } as const;

  // Ten Gods detail on hidden stems per pillar
  const tenGodsDetail = {
    year: getHiddenStemsOfBranch(yearPillar[1]).map(h => ({ stem: h, relation: tenGodRelative(dayPillar[0], h) })),
    month: getHiddenStemsOfBranch(monthPillar[1]).map(h => ({ stem: h, relation: tenGodRelative(dayPillar[0], h) })),
    day: getHiddenStemsOfBranch(dayPillar[1]).map(h => ({ stem: h, relation: tenGodRelative(dayPillar[0], h) })),
    hour: getHiddenStemsOfBranch(hourPillar[1]).map(h => ({ stem: h, relation: tenGodRelative(dayPillar[0], h) }))
  } as const;

  const genderIsMale = input.gender !== 'female';
  const yunFn = (lunar as any).getDaYun;
  const yun = typeof yunFn === 'function' ? yunFn.call(lunar, genderIsMale) : [];
  const daYun: DaYun[] = Array.isArray(yun) ? yun.slice(0,8).map((d:any) => ({
    startAge: typeof d.getStartAge === 'function' ? d.getStartAge() : 0,
    startYear: typeof d.getStartYear === 'function' ? d.getStartYear() : (lunar as any).getYear?.(),
    pillar: typeof d.getGanZhi === 'function' ? d.getGanZhi() : ''
  })) : [];

  const sYear = startYear(lunar, genderIsMale);
  const lnFn = (lunar as any).getLiuNian;
  const liuNian: LiuNian[] = typeof lnFn === 'function'
    ? lnFn.call(lunar, sYear, sYear + 9).map((y:any)=>({ year: y.getYear(), pillar: y.getGanZhi()}))
    : fallbackLiuNianRange(sYear, sYear + 9);

  // Advice: day master strength and favorable elements
  const dayStem = dayPillar[0] as string;
  const dmElement = elementOfStem(dayStem);
  const supporter = elementThatGenerates(dmElement);
  const drain = elementGeneratedBy(dmElement);
  const controller = elementThatControls(dmElement);

  const supportPower = fiveElementPower[dmElement] + fiveElementPower[supporter];
  const totalPower = fiveElementPower.wood + fiveElementPower.fire + fiveElementPower.earth + fiveElementPower.metal + fiveElementPower.water;
  const strengthRatio = totalPower > 0 ? supportPower / totalPower : 0;
  let strength: 'weak'|'balanced'|'strong' = 'balanced';
  if (strengthRatio < 0.28) strength = 'weak';
  else if (strengthRatio > 0.40) strength = 'strong';

  let favorable: Element[] = [];
  let avoid: Element[] = [];
  if (strength === 'weak') {
    favorable = [dmElement, supporter];
    avoid = [controller, drain];
  } else if (strength === 'strong') {
    favorable = [controller, drain];
    avoid = [dmElement, supporter];
  } else {
    favorable = [controller, supporter];
    avoid = [];
  }

  // Relationship graph (stems only)
  const nodes = [
    { id: '年', label: yearPillar[0], kind: 'stem' as const, element: elementOfStem(yearPillar[0]) },
    { id: '月', label: monthPillar[0], kind: 'stem' as const, element: elementOfStem(monthPillar[0]) },
    { id: '日', label: dayPillar[0], kind: 'stem' as const, element: elementOfStem(dayPillar[0]) },
    { id: '时', label: hourPillar[0], kind: 'stem' as const, element: elementOfStem(hourPillar[0]) }
  ];
  const pairIds: [string, string][] = [['日','年'],['日','月'],['日','时'],['年','月'],['月','时'],['年','时']];
  const relationOf = (a: Element, b: Element): '生'|'克'|'同' => {
    if (a === b) return '同';
    if (elementGeneratedBy(a) === b) return '生';
    if (elementThatControls(b) === a) return '克';
    // else reverse? keep as 同
    return '同';
  };
  const edges = pairIds.map(([s,t]) => {
    const ns = nodes.find(n=>n.id===s)!; const nt = nodes.find(n=>n.id===t)!;
    const rel = relationOf(ns.element, nt.element);
    const weight = rel === '同' ? 0.5 : 1;
    return { source: s, target: t, relation: rel, weight };
  });

  // Branch relationship graph (地支关系图)
  const branchNodes = [
    { id: '年支', label: yearPillar[1], kind: 'branch' as const, element: elementOfBranch(yearPillar[1]) },
    { id: '月支', label: monthPillar[1], kind: 'branch' as const, element: elementOfBranch(monthPillar[1]) },
    { id: '日支', label: dayPillar[1], kind: 'branch' as const, element: elementOfBranch(dayPillar[1]) },
    { id: '时支', label: hourPillar[1], kind: 'branch' as const, element: elementOfBranch(hourPillar[1]) }
  ];
  
  // 地支关系判断
  const getBranchRelation = (branch1: string, branch2: string): string => {
    // 三合关系
    const sanHe: Record<string, string[]> = {
      '申子辰': ['申','子','辰'], // 水局
      '寅午戌': ['寅','午','戌'], // 火局
      '巳酉丑': ['巳','酉','丑'], // 金局
      '亥卯未': ['亥','卯','未']  // 木局
    };
    for (const [name, branches] of Object.entries(sanHe)) {
      if (branches.includes(branch1) && branches.includes(branch2)) {
        if (name === '申子辰') return '三合水局';
        if (name === '寅午戌') return '三合火局';
        if (name === '巳酉丑') return '三合金局';
        if (name === '亥卯未') return '三合木局';
        return '三合';
      }
    }
    
    // 六合关系
    const liuHe: Record<string, string> = {
      '子丑': '合化土', '寅亥': '合化木', '卯戌': '合化火',
      '辰酉': '合化金', '巳申': '合化水', '午未': '合化土'
    };
    const pair1 = branch1 + branch2;
    const pair2 = branch2 + branch1;
    if (liuHe[pair1]) return liuHe[pair1];
    if (liuHe[pair2]) return liuHe[pair2];
    
    // 相冲关系
    const chong: Record<string, string> = {
      '子午': '相冲', '丑未': '相冲', '寅申': '相冲',
      '卯酉': '相冲', '辰戌': '相冲', '巳亥': '相冲'
    };
    if (chong[pair1] || chong[pair2]) return '相冲';
    
    // 相害关系
    const hai: Record<string, string> = {
      '子未': '相害', '丑午': '相害', '寅巳': '相害',
      '卯辰': '相害', '申亥': '相害', '酉戌': '相害'
    };
    if (hai[pair1] || hai[pair2]) return '相害';
    
    // 相刑关系
    const xing: Record<string, string> = {
      '寅巳': '相刑', '巳申': '相刑', '申寅': '相刑',
      '丑戌': '相刑', '戌未': '相刑', '未丑': '相刑',
      '子卯': '相刑', '卯子': '相刑'
    };
    if (xing[pair1] || xing[pair2]) return '相刑';
    
    return '无关';
  };
  
  const branchPairs: [string, string][] = [['年支','月支'],['年支','日支'],['年支','时支'],['月支','日支'],['月支','时支'],['日支','时支']];
  const branchEdges = branchPairs.map(([s,t]) => {
    const ns = branchNodes.find(n=>n.id===s)!; 
    const nt = branchNodes.find(n=>n.id===t)!;
    const rel = getBranchRelation(ns.label, nt.label);
    const weight = rel.includes('合') ? 2 : rel === '相冲' ? 1.5 : rel === '相害' ? 1 : rel === '相刑' ? 1 : 0.5;
    return { source: s, target: t, relation: rel, weight };
  }).filter(e => e.relation !== '无关'); // 只显示有关系的连线

  const monthNumber = (lunar as any).getMonth?.() || new Date().getMonth() + 1;
  const stars = computeStars(dayPillar[0], dayPillar[1], monthPillar[1], yearPillar[1], [
    { branch: yearPillar[1] },
    { branch: monthPillar[1] },
    { branch: dayPillar[1] },
    { branch: hourPillar[1] }
  ], monthNumber, dayPillar);

  // ZiWei 12 宫
  const ziweiPalaces = calculateZiweiPalacesCore(lunar, yearPillar, monthPillar, dayPillar, hourPillar);
  // 三方四正：每宫 → 本宫、三方 (±4, ±8)、四正 (±6)
  const triSquares: number[][] = []
  for (let i=0;i<12;i+=1) {
    triSquares[i] = [i, (i+4)%12, (i+8)%12, (i+6)%12]
  }

  // Ten gods strength scoring (simplified): consider 得令/通根/透出
  const monthB = monthPillar[1];
  const hiddenGroups = [yearPillar[1], monthPillar[1], dayPillar[1], hourPillar[1]].map(b=>getHiddenStemsOfBranch(b));
  const exposed = [yearPillar[0], monthPillar[0], hourPillar[0]]; // day is self
  const relations = ['比肩','劫财','食神','伤官','正财','偏财','正官','七杀','正印','偏印'];
  const strengthMap: Record<string,'strong'|'medium'|'weak'> = {};
  relations.forEach(r => {
    const s = scoreTenGod(r, monthB, hiddenGroups, exposed);
    strengthMap[r] = s >= 1.1 ? 'strong' : s >= 0.9 ? 'medium' : 'weak';
  });

  return {
    input: { ...input, normalizedISO },
    year: mk(yearPillar),
    month: mk(monthPillar),
    day: mk(dayPillar),
    hour: mk(hourPillar),
    emptyBranches,
    xunKong,
    fiveElementPower,
    tenGods,
    luckCycles: { daYun, liuNian },
    advice: {
      dayMaster: { stem: dayStem, element: dmElement },
      strength,
      favorable,
      avoid,
      notes: strength === 'weak' ? '日主偏弱，宜取比劫印生之助；谨防官杀财耗。' :
             strength === 'strong' ? '日主偏旺，宜取食伤财官泄化克制；忌再助日主。' :
             '日主中和，宜顺势扶抑得宜，四时平衡。'
    },
    graph: { nodes, edges },
    branchGraph: { nodes: branchNodes, edges: branchEdges },
    stars,
    tenGodsDetail,
    tenGodsStrength: strengthMap
    ,correction
    ,ziwei: { palaces: ziweiPalaces, meta: { triSquares } }
  };
}

function startYear(lunar: Lunar, isMale: boolean): number {
  const dyn = (lunar as any).getDaYun;
  if (typeof dyn === 'function') {
    const first = dyn.call(lunar, isMale)?.[0];
    if (first && typeof first.getStartYear === 'function') return first.getStartYear();
  }
  return (lunar as any).getYear?.() ?? new Date().getFullYear();
}

function fallbackLiuNianRange(start: number, end: number): LiuNian[] {
  const out: LiuNian[] = [];
  for (let y = start; y <= end; y += 1) {
    const l = Lunar.fromDate(new Date(y, 0, 1));
    const ec = EightChar.fromLunar(l);
    out.push({ year: y, pillar: ec.getYear() });
  }
  return out;
}

export type { BaziResult as CalcResult };


