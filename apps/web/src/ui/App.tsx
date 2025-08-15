import { useMemo, useState } from 'react'
import axios from 'axios'
import * as echarts from 'echarts'
// Leaflet is optional at type-level; import dynamically for runtime map rendering
// @ts-ignore
import 'leaflet/dist/leaflet.css'
// @ts-ignore
import L from 'leaflet'
// @ts-ignore - optional runtime dependency for better tz pickup; fallback to offset method if missing
import tzLookup from 'tz-lookup'
import { useEffect, useRef, forwardRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

type CalcResp = {
  year: any; month: any; day: any; hour: any;
  fiveElementPower: { wood:number; fire:number; earth:number; metal:number; water:number }
  luckCycles: { daYun: { startAge:number; startYear:number; pillar:string }[] }
  advice?: { dayMaster:{ stem:string; element:string }; strength:string; favorable:string[]; avoid:string[]; notes:string }
  graph?: { nodes: { id:string; label:string; kind:string; element:string }[]; edges: { source:string; target:string; relation:string; weight:number }[] }
  branchGraph?: { nodes: { id:string; label:string; kind:string; element:string }[]; edges: { source:string; target:string; relation:string; weight:number }[] }
  stars?: { name: string; hits: string[]; group?: string }[]
}

type Profile = { id: string; datetime: string; timezone: string; gender: string; createdAt: number }

const LS_KEY = 'destiny_profiles'

const ELEMENT_CN: Record<string,string> = { wood:'木', fire:'火', earth:'土', metal:'金', water:'水' }
const ELEMENT_COLOR: Record<string,string> = { wood:'#22c55e', fire:'#ef4444', earth:'#eab308', metal:'#f59e0b', water:'#3b82f6' }
const BRANCH_ELEMENT: Record<string,string> = {
  '寅':'wood','卯':'wood',
  '巳':'fire','午':'fire',
  '辰':'earth','丑':'earth','未':'earth','戌':'earth',
  '申':'metal','酉':'metal',
  '亥':'water','子':'water'
}

// ChangSheng stages for 星运/自坐
const STAGE_NAMES = ['长生','沐浴','冠带','临官','帝旺','衰','病','死','墓','绝','胎','养'] as const
const BRANCH_SEQ = ['亥','子','丑','寅','卯','辰','巳','午','未','申','酉','戌']
const START_BRANCH_BY_STEM: Record<string,string> = { '甲':'亥','丙':'寅','戊':'寅','庚':'巳','壬':'申','乙':'午','丁':'酉','己':'酉','辛':'子','癸':'卯' }
function changShengOf(dayStem: string, targetBranch: string): string {
  const start = START_BRANCH_BY_STEM[dayStem] || '亥'
  const isYang = '甲丙戊庚壬'.includes(dayStem)
  const startIdx = BRANCH_SEQ.indexOf(start)
  const targetIdx = BRANCH_SEQ.indexOf(targetBranch)
  if (startIdx < 0 || targetIdx < 0) return ''
  let diff = (targetIdx - startIdx + 12) % 12
  if (!isYang) diff = (startIdx - targetIdx + 12) % 12
  return STAGE_NAMES[diff]
}
const NOTE_CHANGSHENG = '十二长生：长生→沐浴→冠带→临官→帝旺→衰→病→死→墓→绝→胎→养，阴干逆行、阳干顺行，起点依各天干所属。'
const CHANGSHENG_DESC: Record<string,string> = {
  '长生':'如婴儿初生，生机勃勃，开始发展，宜培养扶持',
  '沐浴':'如幼儿洗浴，纯真脆弱，易受影响，需小心呵护',
  '冠带':'如青年加冠，开始成熟，渐有作为，但仍需历练',
  '临官':'如壮年临职，能力渐显，可担重任，正值上升期',
  '帝旺':'如帝王鼎盛，力量最强，功成名就，但盛极必衰',
  '衰':'如中年体衰，力量减弱，需要调养，宜守不宜攻',
  '病':'如身患疾病，阻滞困顿，多有不顺，需要治疗调理',
  '死':'如生命垂危，极度衰弱，万事不利，宜静待转机',
  '墓':'如入墓库中，收藏蛰伏，暂时隐匿，等待时机',
  '绝':'如断绝生机，到达谷底，但物极必反，孕育新生',
  '胎':'如受孕成胎，新的开始，潜力初现，需要孕育',
  '养':'如婴儿哺养，逐渐成长，积蓄力量，准备长生'
}
type ShenSha = '桃花' | '驿马' | '华盖'
const STAR_DESC: Record<string,string> = {
  // 三合类
  '桃花': '主异性缘、艺术美感；旺则多情，宜节制',
  '驿马': '主奔波动迁、差旅出行，动而有机',
  '华盖': '主清高孤寡、宗教学术之气，宜融群',
  // 贵人类
  '天乙贵人': '最大贵人星，遇难逢凶化吉',
  '太极贵人': '心性仁慈，有贵气助力',
  '天德贵人': '阴德护体，化解是非病灾',
  '月德贵人': '德曜照临，多得人和与扶助',
  '德秀贵人': '才德兼备，利学业与科名',
  '三奇贵人': '甲戊庚为阳奇、乙丙丁为阴奇、壬癸辛为水奇，主奇遇',
  '福星贵人': '多福厚泽，得长辈提携',
  '文昌贵人': '主文运科名、写作考试利',
  '国印贵人': '权印加持，名望与资质',
  '天官贵人': '天官赐福，贵助临门',
  '天福贵人': '福分相随，逢凶化吉',
  // 禄马学文
  '禄神': '禄位所临，主资源与俸禄',
  '天马': '主迁移变动、机会在动',
  '学堂': '聪慧学习、重视知识',
  '词馆': '文笔表达、科甲文章',
  // 刃煞类
  '羊刃': '刚烈决断，需制衡为佳',
  '飞刃': '刚猛易急，宜缓和节制',
  '劫煞': '多波折争夺，宜防突变',
  '灾煞': '易有障碍、事故阻滞',
  '天煞': '外来变故，需稳健应对',
  // 桃花类
  '咸池桃花': '风流艳事之桃花，随局论吉凶',
  '红艳': '魅力外放，情缘浓烈',
  '红鸾': '喜庆姻缘之星，利婚恋',
  '天喜': '喜气人和，易有喜事',
  '流霞': '宴饮色彩，多娱乐应酬',
  // 孤寡类
  '孤辰': '性清孤傲，宜沟通合群',
  '寡宿': '独处慎独，宜增人际协作',
  '孤鸾煞': '婚恋多波折，宜审慎经营',
  '阴阳差错': '阴阳错配，处事多误差',
  // 华盖将星
  '将星': '领导魄力，宜正道用权',
  '金舆': '华贵礼仪与保障资源',
  // 空亡类
  '截路空亡': '行事多阻隔，宜迂回布局',
  // 刑冲害自刑
  '三刑': '支支相刑，主刑克阻滞',
  '六冲': '支支相冲，动荡变更',
  '六害': '支支相害，不合不利',
  '自刑': '自我牵制，易纠结',
  // 疾病类
  '病符': '病符临身，注意健康',
  '死符': '精力低迷，宜修养',
  '天医': '医药助力，利治病疗伤',
  '天寿星': '寿元与福禄，重养生',
  // 丧吊类
  '丧门': '主丧事忧戚，宜宽心',
  '吊客': '主吊唁奔波，宜谨慎',
  '披麻': '与丧服相关之象，慎言行',
  '白虎': '刚猛之煞，防伤灾血光',
  // 特殊格局
  '魁罡': '刚烈孤高，宜学礼化权',
  '日德': '日元得德，事多顺遂',
  '金神': '金气过旺，宜火制化',
  '四废': '时令不利，宜避其忌时',
  '四忌': '季节忌神，避其所忌',
  // 天罗地网
  '天罗': '束缚牵连，宜守不宜攻',
  '地网': '羁绊羁缚，宜稳健处置',
  // 童子花姐（简化）
  '童子煞': '缘分多迟，童缘重，宜化解',
  '花姐煞': '情事纠缠，宜定性',
  // 时辰与败财破家
  '日禄归时': '禄归时地，利把握时机',
  '十恶大败': '十日之忌，宜避关键决策',
  '铁扫帚': '多扫荡之象，防财散家耗',
  '破月': '岁破月，易破败，宜谨慎',
  '绝火': '火气绝处，防燥急与灾',
  // 其它同名条目
  '咸池': '桃花之一名，主人缘与艳事，随局论吉凶',
  // 兼容：若后端返回不同命名
  '文昌': '主文魁才学、考试利（兼容命名）',
  '天德': '阴德护体（兼容简表）',
  '月德': '德曜扶助（兼容简表）'
}

const TEN_GOD_DESC: Record<string,string> = {
  '比肩':'同我同气，助身扶身，旺则争比克财',
  '劫财':'同性同气，助身夺财，宜制衡',
  '食神':'我泄生他，温和之气，旺则制杀生财',
  '伤官':'我泄过度，聪慧外放，旺则伤官见官为忌',
  '正财':'我克之财，勤俭务实，忌被劫夺',
  '偏财':'横财机遇，宜收敛节制',
  '正官':'克我而正，规矩秩序，旺则压身',
  '七杀':'克我而偏，魄力权柄，宜食神制杀',
  '正印':'生我而正，涵养支持，旺则惰性',
  '偏印':'生我而偏，机敏灵动，忌过旺化为枭神'
}
const NOTE_NAYIN = '纳音：六十甲子配五行之名，用以辅佐判断气质与声气。'
const NOTE_XUNKONG = '旬空：该旬中欠缺之支，遇空则象征事物不固或延期。'
const XUNKONG_DESC: Record<string,string> = {
  '子':'子水空亡，情感波动，水性不定',
  '丑':'丑土空亡，财库不稳，积蓄有变',
  '寅':'寅木空亡，生发受阻，计划多变',
  '卯':'卯木空亡，才华难显，文书有失',
  '辰':'辰土空亡，库藏不实，变动频繁',
  '巳':'巳火空亡，智慧受限，文昌不利',
  '午':'午火空亡，名声有损，心神不宁',
  '未':'未土空亡，福德有缺，人际波折',
  '申':'申金空亡，权威不稳，变动多端',
  '酉':'酉金空亡，口舌是非，金钱有失',
  '戌':'戌土空亡，根基不稳，变迁频繁',
  '亥':'亥水空亡，智慧蒙蔽，学业有阻'
}
const NAYIN_DESC: Record<string,string> = {
  '海中金':'海底之金，藏锋蓄势，遇火土则成器。',
  '炉中火':'炉冶之火，需薪助旺，得木为佳。',
  '大林木':'林木茂盛，喜金水修饰滋养。',
  '路旁土':'道路之土，宜修整培护，得木疏土。',
  '剑锋金':'刃金之性，喜火锻炼成器。',
  '山头火':'山巅之火，势高烈，得木为薪。',
  '涧下水':'溪涧流泉，喜土成渠，遇金更清。',
  '城头土':'城垣之土，厚重稳固，忌木穿克。',
  '白蜡金':'饰器之金，需火炼形，遇水恐损光。',
  '杨柳木':'柔木之象，得水滋润，忌金砍伐。',
  '井泉水':'井泉之水，贵清澄，得金导流。',
  '屋上土':'覆屋之土，能蔽风雨，喜木为梁。',
  '霹雳火':'雷火激烈，遇金为电，畏水遏势。',
  '松柏木':'常青之木，耐寒耐霜，得水更荣。',
  '长流水':'江河之水，源远流长，得土为堤。',
  '沙中金':'沙里藏金，需淘洗炼成器。',
  '山下火':'山麓之火，势渐旺，喜木添薪。',
  '平地木':'原野之木，得水土滋养成林。',
  '壁上土':'墙垣之土，需木为架，畏水冲刷。',
  '金箔金':'饰面之金，喜火炼形，忌土尘蔽光。',
  '覆灯火':'灯烛之火，需油薪，畏水扑灭。',
  '天河水':'银河之水，清凉灵动，喜金为器。',
  '大驿土':'大道之土，承载往来，畏木穿克。',
  '钗钏金':'首饰之金，喜火锻造成形。',
  '桑柘木':'桑柘之木，得水育桑，宜修剪。',
  '大溪水':'大溪之水，急流奔涌，喜土为堤。',
  '沙中土':'细沙之土，需水固结成型。',
  '天上火':'天曜之火，光明昭彰，畏水压制。',
  '石榴木':'果木之象，得水肥而丰实。',
  '大海水':'汪洋之水，包容万物，喜金导流。'
}
function groupBySanHe(branch: string): '申子辰'|'寅午戌'|'巳酉丑'|'亥卯未'|null {
  if (['申','子','辰'].includes(branch)) return '申子辰'
  if (['寅','午','戌'].includes(branch)) return '寅午戌'
  if (['巳','酉','丑'].includes(branch)) return '巳酉丑'
  if (['亥','卯','未'].includes(branch)) return '亥卯未'
  return null
}
function starPos(group: ReturnType<typeof groupBySanHe>, star: ShenSha): string | null {
  if (!group) return null
  const map: Record<string, Record<ShenSha, string>> = {
    '申子辰': { '桃花':'酉', '驿马':'寅', '华盖':'辰' },
    '寅午戌': { '桃花':'卯', '驿马':'申', '华盖':'戌' },
    '巳酉丑': { '桃花':'午', '驿马':'亥', '华盖':'丑' },
    '亥卯未': { '桃花':'子', '驿马':'巳', '华盖':'未' }
  }
  return map[group]?.[star] ?? null
}
function computeShenShaPositions(pillars: { branch:string }[], dayBranch: string) {
  const group = groupBySanHe(dayBranch)
  const stars: ShenSha[] = ['桃花','驿马','华盖']
  const results: { name: ShenSha; hits: string[] }[] = []
  const labels = ['年','月','日','时']
  stars.forEach(s => {
    const pos = starPos(group, s)
    if (!pos) return
    const hits = pillars.map((p,i)=> ({p, i})).filter(x=> x.p.branch === pos).map(x=> labels[x.i])
    if (hits.length>0) results.push({ name: s, hits })
  })
  return results
}

// ===== ZiWei chart types and helpers =====
type ZiweiStarType = 'main' | 'assist' | 'transform' | 'misc'
type ZiweiPalace = { key: string; name: string; stars: { name: string; type: ZiweiStarType }[] }

const ZW_PALACE_ORDER: { key: string; name: string }[] = [
  { key:'m', name:'命宫' },{ key:'xb', name:'兄弟' },{ key:'fp', name:'夫妻' },{ key:'zn', name:'子女' },
  { key:'cb', name:'财帛' },{ key:'je', name:'疾厄' },{ key:'qy', name:'迁移' },{ key:'py', name:'仆役' },
  { key:'gl', name:'官禄' },{ key:'tz', name:'田宅' },{ key:'fd', name:'福德' },{ key:'fm', name:'父母' }
]

function generateZiweiDemo(data: any): ZiweiPalace[] {
  // 简易演示：根据日支索引旋转主星落宫，非严谨排盘，仅用于 UI 演示
  const branches = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
  const idx = Math.max(0, branches.indexOf(data?.day?.earthlyBranch))
  const rotate = <T,>(arr: T[], k: number) => arr.map((_,i)=> arr[(i+k)%arr.length])
  const mainStars = rotate(['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁'], idx)
  const assists = ['左辅','右弼','文昌','文曲','天魁','天钺']
  const transforms = ['化禄','化权','化科','化忌']
  return ZW_PALACE_ORDER.map((p,i)=> ({
    key: p.key,
    name: p.name,
    stars: [
      { name: mainStars[i], type: 'main' as const },
      { name: assists[i%assists.length], type: 'assist' as const },
      { name: transforms[i%transforms.length], type: 'transform' as const }
    ]
  }))
}

function useEchart(option: any) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    let disposed = false
    let inMain = false
    const ensureInit = () => {
      if (!ref.current || disposed) return
      const el = ref.current as HTMLDivElement
      const style = window.getComputedStyle(el)
      const hidden = style.display === 'none' || el.clientWidth === 0 || el.clientHeight === 0
      if (hidden) { requestAnimationFrame(ensureInit); return }
      inMain = true
      const c = echarts.getInstanceByDom(el) || echarts.init(el)
      c.setOption(option)
      inMain = false
    }
    ensureInit()
    const onResize = () => {
      const el = ref.current as HTMLDivElement | null
      if (!el) return
      const c = echarts.getInstanceByDom(el)
      if (c) { if (inMain) { setTimeout(() => c.resize(), 0) } else { requestAnimationFrame(() => c.resize()) } }
    }
    window.addEventListener('resize', onResize)
    // Observe container size changes to keep chart centered when sibling cards change height
    let ro: any = null
    try {
      const R = (window as any).ResizeObserver
      if (R && ref.current) {
        ro = new R(() => { const el = ref.current as HTMLDivElement | null; if (!el) return; const c = echarts.getInstanceByDom(el); if (c) { if (inMain) { setTimeout(() => c.resize(), 0) } else { requestAnimationFrame(() => c.resize()) } } })
        ro.observe(ref.current)
      }
    } catch {}
    return () => { disposed = true; if (ro && ro.disconnect) ro.disconnect(); window.removeEventListener('resize', onResize); const el = ref.current as HTMLDivElement | null; if (el) { const c = echarts.getInstanceByDom(el); if (c) c.dispose() } }
  }, [JSON.stringify(option)])
  return ref
}

// Lightweight edge-aware tooltip directive (attribute-based)
function useEdgeAwareTooltips() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const host = t?.closest?.('.tooltip') as HTMLElement | null;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      host.removeAttribute('data-edge');
      const margin = 16;
      if (rect.left < margin) host.setAttribute('data-edge','left');
      else if (window.innerWidth - rect.right < margin) host.setAttribute('data-edge','right');
      else if (rect.top < 80) host.setAttribute('data-edge','top');
    };
    document.addEventListener('mousemove', handler, { passive: true });
    return () => document.removeEventListener('mousemove', handler as any);
  }, []);
}

export function App() {
  const [form, setForm] = useState({ datetime: new Date().toISOString().slice(0,16), timezone: 'Asia/Shanghai', gender: 'male', useTrueSolarTime: false as boolean, lat: '' as string, lon: '' as string })
  const [gregDate, setGregDate] = useState<Date>(new Date())
  const [lunarDerivedISO, setLunarDerivedISO] = useState<string>('')
  const [calendar, setCalendar] = useState<'gregorian'|'lunar'>('gregorian')
  const [lunar, setLunar] = useState<{ year: string; month: string; day: string; isLeap: boolean; hour: string; minute: string }>({ year: String(new Date().getFullYear()), month: '1', day: '1', isLeap: false, hour: '0', minute: '0' })
  const [showTzMap, setShowTzMap] = useState(false)
  const [showCoordMap, setShowCoordMap] = useState(false)
  const [showLunarQuick, setShowLunarQuick] = useState(false)
  const tzMapRef = useRef<HTMLDivElement>(null)
  const coordMapRef = useRef<HTMLDivElement>(null)
  const tzLeaflet = useRef<L.Map | null>(null)
  const coordLeaflet = useRef<L.Map | null>(null)
  const [tzCandidate, setTzCandidate] = useState<string>('')
  const [coordCandidate, setCoordCandidate] = useState<{ lat:number; lon:number } | null>(null)
  const [data, setData] = useState<CalcResp | null>(null)
  const [lang, setLang] = useState<'zh'|'en'>('zh')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
  })
  const [isDark, setIsDark] = useState<boolean>(false)
  const [graphTab, setGraphTab] = useState<'stem'|'branch'|'palace'|'kin'|'ziwei'>('stem')
  const [zwFocus, setZwFocus] = useState<number | null>(null)
  const [zwTransitTab, setZwTransitTab] = useState<'natal'|'year'|'month'|'day'>('natal')
  const [zwTransitDate, setZwTransitDate] = useState<string>(()=> new Date().toISOString().slice(0,16))
  const [zwTransit, setZwTransit] = useState<any|null>(null)
  useEdgeAwareTooltips()

  const dict = useMemo(() => ({
    zh: {
      title: '八字命理', input: '输入生辰', datetime: '日期时间', timezone: '时区', gender: '性别', male: '男', female: '女',
      submit: '排盘', calculating: '计算中…', five: '五行能量', chart_months: '流月', bazi: '命盘',
      export: '导出PDF', daymaster: '日主', strength: '强弱', favorable: '喜用', avoid: '忌讳', notes: '说明', history: '历史记录', save: '保存', theme: '主题', light: '阳', dark: '阴',
      trueSolar: '真太阳时', latitude: '纬度', longitude: '经度',
      calendar: '历法', gregorian: '公历', lunar: '农历', leapMonth: '闰月', tzPickOnMap: '地图选择', coordPickOnMap: '地图选点'
    },
    en: {
      title: 'BaZi Analyzer', input: 'Birth Input', datetime: 'Datetime', timezone: 'Timezone', gender: 'Gender', male: 'Male', female: 'Female',
      submit: 'Calculate', calculating: 'Calculating…', five: 'Five Elements', chart_months: 'Months (This Year)', bazi: 'BaZi Board',
      export: 'Export PDF', daymaster: 'Day Master', strength: 'Strength', favorable: 'Favorable', avoid: 'Avoid', notes: 'Notes', history: 'History', save: 'Save', theme: 'Theme', light: 'Light', dark: 'Dark',
      trueSolar: 'True Solar Time', latitude: 'Latitude', longitude: 'Longitude',
      calendar: 'Calendar', gregorian: 'Gregorian', lunar: 'Lunar', leapMonth: 'Leap', tzPickOnMap: 'Pick on map', coordPickOnMap: 'Pick on map'
    }
  }), [])
  const t = (k: keyof typeof dict['zh']) => (dict as any)[lang][k] || k

  useEffect(() => {
    const root = document.documentElement
    if (isDark) root.classList.add('dark'); else root.classList.remove('dark')
  }, [isDark])

  // -------- Leaflet maps --------
  useEffect(() => {
    if (!showTzMap) return
    const host = tzMapRef.current
    if (!host) return
    if (tzLeaflet.current) {
      tzLeaflet.current.invalidateSize();
      return
    }
    const map = L.map(host, { worldCopyJump: true, zoomControl: true, attributionControl: true }).setView([20, 0], 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map)
    map.on('click', (e: any) => {
      try {
        const z = tzLookup ? tzLookup(e.latlng.lat, e.latlng.lng) : null
        if (z) setTzCandidate(z)
        else {
          // Fallback: round to 15-degree offset
          const raw = Math.round(e.latlng.lng / 15)
          const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || (raw>=0?`Etc/GMT-${raw}`:`Etc/GMT+${Math.abs(raw)}`)
          setTzCandidate(tzName)
        }
      } catch {
        const raw = Math.round(e.latlng.lng / 15)
        const tzName = raw>=0?`Etc/GMT-${raw}`:`Etc/GMT+${Math.abs(raw)}`
        setTzCandidate(tzName)
      }
    })
    tzLeaflet.current = map
    setTimeout(()=> map.invalidateSize(), 100)
    return () => {}
  }, [showTzMap])

  useEffect(() => {
    if (!showCoordMap) return
    const host = coordMapRef.current
    if (!host) return
    if (coordLeaflet.current) {
      coordLeaflet.current.invalidateSize();
      return
    }
    const map = L.map(host, { worldCopyJump: true, zoomControl: true, attributionControl: true }).setView([20, 0], 2)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map)
    let marker: L.Marker<any> | null = null
    map.on('click', (e: any) => {
      const lat = Number(e.latlng.lat.toFixed(6))
      const lon = Number(e.latlng.lng.toFixed(6))
      setCoordCandidate({ lat, lon })
      if (marker) marker.remove()
      marker = L.marker([lat, lon]).addTo(map)
    })
    coordLeaflet.current = map
    setTimeout(()=> map.invalidateSize(), 100)
    return () => {}
  }, [showCoordMap])

  const radarOption = useMemo(() => ({
    backgroundColor: 'transparent',
    textStyle: { color: '#bfc7d5' },
    radar: {
      indicator: [
        { name: '木', max: 5 }, { name: '火', max: 5 }, { name: '土', max: 5 }, { name: '金', max: 5 }, { name: '水', max: 5 }
      ],
      splitLine: { lineStyle: { color: ['#2a2f3a'] } },
      splitArea: { areaStyle: { color: ['transparent'] } },
      axisLine: { lineStyle: { color: '#2a2f3a' } }
    },
    series: [{
      type: 'radar',
      itemStyle: { color: '#d4af37' },
      areaStyle: { opacity: 0.15 },
      data: data ? [[
        data.fiveElementPower.wood,
        data.fiveElementPower.fire,
        data.fiveElementPower.earth,
        data.fiveElementPower.metal,
        data.fiveElementPower.water
      ]] : [[0,0,0,0,0]]
    }]
  }), [data])

  const radarRef = useEchart(radarOption)

  // enhanced radar with rich labels and split areas
  const enhancedRadar = useMemo(() => {
    const values = data ? [
      data.fiveElementPower.wood,
      data.fiveElementPower.fire,
      data.fiveElementPower.earth,
      data.fiveElementPower.metal,
      data.fiveElementPower.water
    ] : [0,0,0,0,0]
    const isDarkTheme = document.documentElement.classList.contains('dark')
    const gridColor = isDarkTheme ? 'rgba(148,163,184,0.35)' : 'rgba(71,85,105,0.35)'
    const textColor = isDarkTheme ? '#e5e7eb' : '#0f172a'
    const areaColor = isDarkTheme ? 'rgba(212,175,55,0.25)' : 'rgba(184,134,11,0.25)'
    const lineColor = isDarkTheme ? 'rgba(212,175,55,0.95)' : 'rgba(184,134,11,0.95)'
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p:any) => {
          const v = values
          const names = ['木','火','土','金','水']
          return names.map((n,i)=> `${n}：<b>${v[i].toFixed(2)}</b>`).join('<br/>')
        }
      },
      radar: {
        center: ['50%','50%'],
        radius: '70%',
        indicator: [
          { name: '木 (生发)', max: 10 },
          { name: '火 (炎上)', max: 10 },
          { name: '土 (稼穑)', max: 10 },
          { name: '金 (肃杀)', max: 10 },
          { name: '水 (润下)', max: 10 }
        ],
        axisName: { color: textColor },
        axisLine: { lineStyle: { color: gridColor } },
        splitLine: { lineStyle: { color: [gridColor] } },
        splitArea: { areaStyle: { color: ['transparent', isDarkTheme?'rgba(212,175,55,0.06)':'rgba(184,134,11,0.06)'] } }
      },
      series: [{
        type: 'radar',
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: lineColor },
        itemStyle: { color: lineColor, borderColor: isDarkTheme?'#000':'#fff', borderWidth: 1 },
        areaStyle: { color: areaColor },
        data: [values]
      }]
    }
  }, [data])
  const enhancedRadarRef = useEchart(enhancedRadar)

  // graph visualization (stems relation) - 简约玄美风格
  const graphOption = useMemo(() => {
    if (!data?.graph) return { series: [] }
    const palette: Record<string, string> = { 
      wood:'#6b7280', fire:'#9ca3af', earth:'#d4af37', metal:'#94a3b8', water:'#64748b' 
    }
    const edgeColor: Record<string,string> = { 
      '生':'rgba(16,185,129,0.9)', '克':'rgba(239,68,68,0.9)', '同':'rgba(148,163,184,0.75)' 
    }
    const relationDesc: Record<string,string> = {
      '生':'相生助力，和谐互补',
      '克':'相克制约，需要平衡', 
      '同':'同气相求，力量叠加'
    }
    const isDark = document.documentElement.classList.contains('dark')
    const nodes = data.graph.nodes
    const edges = data.graph.edges
    const hasIsolated = nodes.some(n => !edges.some(e => e.source === n.id || e.target === n.id))
    const useCircular = hasIsolated
    
    return {
      backgroundColor: 'transparent',
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(14,19,26,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.3)',
        borderWidth: 1,
        textStyle: { color: isDark ? '#e5e7eb' : '#374151', fontSize: 12 },
        formatter: (p:any) => {
          if (p.dataType === 'node') {
            const elementCN = { wood:'木', fire:'火', earth:'土', metal:'金', water:'水' }
            return `<div style="font-weight:500;color:var(--gold);">${p.data.id}柱·${p.data.label}</div><div style="margin-top:4px;font-size:11px;opacity:0.8;">${elementCN[p.data.element as keyof typeof elementCN] || p.data.element}行之气</div>`
          }
          if (p.dataType === 'edge') {
            return `<div style="font-weight:500;">${p.data.source} ${p.data.relation} ${p.data.target}</div><div style="margin-top:4px;font-size:11px;opacity:0.8;">${relationDesc[p.data.relation] || ''}</div>`
          }
          return ''
        }
      },
      series: [{
        type: 'graph',
        layout: useCircular ? 'circular' : 'force',
        circular: { rotateLabel: false },
        force: { repulsion: 180, gravity: 0.02, edgeLength: 120, layoutAnimation: false },
        symbolSize: 40,
        roam: false,
        animation: false,
        animationDuration: 0,
        animationDurationUpdate: 0,
        left: 'center',
        top: 'middle',
        width: '86%',
        height: '90%',
        label: { 
          show: true, 
          color: isDark ? '#f9fafb' : '#1f2937',
          fontWeight: 500, 
          fontSize: 13,
          fontFamily: '"Noto Serif SC", serif',
          backgroundColor: 'transparent',
          formatter: (params: any) => `${params.data.id}\n${params.data.label}`
        },
        edgeSymbol: ['none','arrow'],
        edgeSymbolSize: [0, 9],
        edgeLabel: { 
          show: true,
          color: isDark ? 'rgba(156,163,175,0.8)' : 'rgba(107,114,128,0.8)',
          fontSize: 10,
          fontWeight: 400,
          formatter: (params: any) => params.data.relation
        },
        emphasis: { 
          focus: 'adjacency',
          scale: 1.08,
          lineStyle: { width: 3, opacity: 1 }
        },
        itemStyle: { 
          borderColor: isDark ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.4)', 
          borderWidth: 1.5, 
          shadowBlur: 6, 
          shadowColor: 'rgba(212,175,55,0.15)' 
        },
        lineStyle: { 
          curveness: 0.15, 
          opacity: 0.9
        },
        data: data.graph.nodes.map(n => ({
          id: n.id, 
          name: `${n.id}柱${n.label}`, 
          label: n.label, 
          value: n.id === '日' ? 2 : 1,
          element: n.element,
          symbolSize: n.id === '日' ? 45 : 40,
          itemStyle: { 
            color: n.id === '日' ? '#d4af37' : (palette[n.element] || '#94a3b8'),
            borderColor: n.id === '日' ? 'rgba(212,175,55,0.6)' : 'rgba(212,175,55,0.3)',
            borderWidth: n.id === '日' ? 2 : 1.5
          }
        })),
        links: data.graph.edges.map(e => ({
          source: e.source, 
          target: e.target, 
          relation: e.relation,
          lineStyle: { 
            color: edgeColor[e.relation] || 'rgba(148,163,184,0.75)', 
            width: 2.4, 
            opacity: 0.95
          }
        }))
      }]
    }
  }, [data])
  const graphRef = useEchart(graphOption)

  // 地支关系图 - 简约玄美风格
  const branchGraphOption = useMemo(() => {
    if (!data?.branchGraph) return { series: [] }
    const palette: Record<string, string> = { 
      wood:'#6b7280', fire:'#9ca3af', earth:'#d4af37', metal:'#94a3b8', water:'#64748b' 
    }
    const relationColors: Record<string,string> = {
      '合化水':'rgba(59,130,246,0.9)', '合化木':'rgba(34,197,94,0.9)', '合化火':'rgba(239,68,68,0.9)', 
      '合化土':'rgba(234,179,8,0.9)', '合化金':'rgba(245,158,11,0.9)', 
      '三合水局':'rgba(59,130,246,0.95)', '三合火局':'rgba(239,68,68,0.95)', 
      '三合金局':'rgba(245,158,11,0.95)', '三合木局':'rgba(34,197,94,0.95)',
      '三合':'rgba(16,185,129,0.9)', '相冲':'rgba(220,38,38,0.95)', 
      '相害':'rgba(245,158,11,0.9)', '相刑':'rgba(124,45,18,0.9)'
    }
    const relationDesc: Record<string,string> = {
      '合化水':'六合化水，情投意合', '合化木':'六合化木，生发有力',
      '合化火':'六合化火，热情奔放', '合化土':'六合化土，稳重厚实',
      '合化金':'六合化金，坚定果决', 
      '三合水局':'三合水局，智慧流动', '三合火局':'三合火局，热情奔放',
      '三合金局':'三合金局，坚毅果决', '三合木局':'三合木局，生发向上',
      '三合':'三合成局，力量倍增', '相冲':'正面对冲，动荡不安', 
      '相害':'暗中相害，阻滞不利', '相刑':'刑克伤害，多有波折'
    }
    const isDark = document.documentElement.classList.contains('dark')
    const nodes = data.branchGraph.nodes
    const edges = data.branchGraph.edges
    const hasIsolated = nodes.some(n => !edges.some(e => e.source === n.id || e.target === n.id))
    const useCircular = hasIsolated
    
    return {
      backgroundColor: 'transparent',
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(14,19,26,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.3)',
        borderWidth: 1,
        textStyle: { color: isDark ? '#e5e7eb' : '#374151', fontSize: 12 },
        formatter: (p:any) => {
          if (p.dataType === 'node') {
            const elementCN = { wood:'木', fire:'火', earth:'土', metal:'金', water:'水' }
            return `<div style="font-weight:500;color:var(--gold);">${p.data.id}·${p.data.label}</div><div style="margin-top:4px;font-size:11px;opacity:0.8;">${elementCN[p.data.element as keyof typeof elementCN] || p.data.element}行之气</div>`
          }
          if (p.dataType === 'edge') {
            return `<div style="font-weight:500;">${p.data.source} ${p.data.relation} ${p.data.target}</div><div style="margin-top:4px;font-size:11px;opacity:0.8;">${relationDesc[p.data.relation] || ''}</div>`
          }
          return ''
        }
      },
      series: [{
        type: 'graph',
        layout: useCircular ? 'circular' : 'force',
        circular: { rotateLabel: false },
        force: { repulsion: 200, gravity: 0.03, edgeLength: 130, layoutAnimation: false },
        symbolSize: 42,
        roam: false,
        animation: false,
        animationDuration: 0,
        animationDurationUpdate: 0,
        left: 'center',
        top: 'middle',
        width: '86%',
        height: '90%',
        label: { 
          show: true, 
          color: isDark ? '#f9fafb' : '#1f2937',
          fontWeight: 500, 
          fontSize: 14,
          fontFamily: '"Noto Serif SC", serif',
          backgroundColor: 'transparent',
          formatter: (params: any) => `${params.data.id.replace('支','')}\n${params.data.label}`
        },
        edgeSymbol: ['none','arrow'],
        edgeSymbolSize: [0, 8],
        edgeLabel: { 
          show: true,
          color: isDark ? 'rgba(156,163,175,0.7)' : 'rgba(107,114,128,0.7)',
          fontSize: 9,
          fontWeight: 400,
          formatter: (params: any) => params.data.relation.length > 3 ? params.data.relation.slice(0,2) : params.data.relation
        },
        emphasis: { 
          focus: 'adjacency',
          scale: 1.1,
          lineStyle: { width: 3, opacity: 1 }
        },
        itemStyle: { 
          borderColor: isDark ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.4)', 
          borderWidth: 1.5, 
          shadowBlur: 8, 
          shadowColor: 'rgba(212,175,55,0.2)' 
        },
        lineStyle: { 
          curveness: 0.2, 
          opacity: 0.95
        },
        data: data.branchGraph.nodes.map(n => ({
          id: n.id, 
          name: `${n.id}${n.label}`, 
          label: n.label, 
          value: n.id === '日支' ? 2 : 1,
          element: n.element,
          symbolSize: n.id === '日支' ? 47 : 42,
          itemStyle: { 
            color: n.id === '日支' ? '#d4af37' : (palette[n.element] || '#94a3b8'),
            borderColor: n.id === '日支' ? 'rgba(212,175,55,0.6)' : 'rgba(212,175,55,0.3)',
            borderWidth: n.id === '日支' ? 2 : 1.5
          }
        })),
        links: data.branchGraph.edges.map(e => ({
          source: e.source, 
          target: e.target, 
          relation: e.relation,
          lineStyle: { 
            color: relationColors[e.relation] || 'rgba(148,163,184,0.75)', 
            width: 2.4, 
            opacity: 0.95
          }
        }))
      }]
    }
  }, [data])
  const branchGraphRef = useEchart(branchGraphOption)

  // 宫位图使用 Sunburst 呈现（根为日主 → 四宫 → 十神明细，现代简约风）
  const palaceGraphOption = useMemo(() => {
    if (!data) return { series: [] }
    const isDark = document.documentElement.classList.contains('dark')
    const tenGods = (data as any).tenGods || {}
    const tenGodsDetail = (data as any).tenGodsDetail || {}
    const tenGodsStrength = (data as any).tenGodsStrength || {}
    const getGroup = (tenGod: string | undefined) => {
      if (!tenGod) return '其它'
      if (tenGod.includes('比') || tenGod.includes('劫')) return '兄弟'
      if (tenGod.includes('食') || tenGod.includes('伤')) return '子女'
      if (tenGod.includes('财')) return '财/妻'
      if (tenGod.includes('官') || tenGod.includes('杀')) return '官/夫'
      if (tenGod.includes('印')) return '父母'
      return '其它'
    }
    const colorOf: Record<string,string> = {
      '父母': 'rgba(99,102,241,0.95)',
      '兄弟': 'rgba(148,163,184,0.95)',
      '财/妻': 'rgba(212,175,55,0.95)',
      '官/夫': 'rgba(239,68,68,0.95)',
      '子女': 'rgba(16,185,129,0.95)',
      '其它': isDark ? 'rgba(148,163,184,0.75)' : 'rgba(71,85,105,0.85)'
    }
    const childrenRaw = [
      { key: 'year', name: '父母宫', label: `${data.year.heavenlyStem}${data.year.earthlyBranch}` },
      { key: 'month', name: '兄弟宫', label: `${data.month.heavenlyStem}${data.month.earthlyBranch}` },
      { key: 'day', name: '夫妻宫', label: `${data.day.heavenlyStem}${data.day.earthlyBranch}` },
      { key: 'hour', name: '子女宫', label: `${data.hour.heavenlyStem}${data.hour.earthlyBranch}` }
    ] as any[]
    const strengthWeight = (lvl: string) => lvl==='strong'?1.3 : lvl==='weak'?0.7 : 1.0
    const pillarWeight: Record<string, number> = { year: 1.05, month: 1.05, day: 1.20, hour: 1.00 }
    const children = childrenRaw.map((p:any) => {
      const tg = tenGods?.[p.key]
      const kWeight = pillarWeight[p.key as keyof typeof pillarWeight] || 1
      const rawDetail = (tenGodsDetail?.[p.key] || []) as any[]
      // 按十神聚合并加权
      const contrib: Record<string, number> = {}
      rawDetail.forEach(d => {
        const relRaw = d?.relation as string | undefined
        const rel = (relRaw && typeof relRaw === 'string' ? relRaw.trim() : '')
        if (!rel || rel.toLowerCase() === 'undefined' || rel === '-') return
        const lvl = tenGodsStrength[rel] || 'medium'
        const w = 1 * strengthWeight(lvl) * kWeight
        contrib[rel] = (contrib[rel] || 0) + w
      })
      if (tg && typeof tg === 'string' && tg !== '-' && tg.toLowerCase() !== 'undefined') {
        const lvlTop = tenGodsStrength[String(tg)] || 'medium'
        const wTop = 1.6 * strengthWeight(lvlTop) * kWeight
        contrib[String(tg)] = (contrib[String(tg)] || 0) + wTop
      }
      const entries = Object.entries(contrib).sort((a,b)=> b[1]-a[1])
      const total = entries.reduce((s,[,v])=> s+v, 0)
      const topN = entries.slice(0,6)
      const maxV = Math.max(...topN.map(([,v])=>v), 1)
      const childrenNodes = topN.map(([rel, v]) => ({
        name: rel || '其它',
        value: Number(v.toFixed(3)),
        itemStyle: { color: colorOf[getGroup(rel) || '其它'], opacity: 0.65 + 0.3*(v/maxV) },
        label: { show: true, formatter: `${rel || '其它'} ${v.toFixed(2)}`, width: 90, overflow: 'truncate' }
      }))
      return {
        name: p.name,
        value: Number(total.toFixed(3)) || 1,
        label: { show: true, formatter: `${p.name}\n${p.label}`, width: 100, overflow: 'truncate' },
        itemStyle: { color: colorOf[getGroup(tg)] },
        labelText: p.label,
        tenGod: tg,
        detail: entries,
        children: childrenNodes
      }
    })
    // 全量清洗，防止任何空名/undefined 名称进入图表
    const sanitizeName = (n: any) => {
      const s = String(n ?? '').trim()
      if (!s || s === '-' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return '其它'
      return s
    }
    const sanitizeNodes = (nodes: any[]): any[] => nodes
      .filter(n => n && (n.name != null || (Array.isArray(n.children) && n.children.length>0)))
      .map(n => ({
        ...n,
        name: sanitizeName(n.name),
        children: Array.isArray(n.children) ? sanitizeNodes(n.children) : undefined
      }))
    const safeChildren = sanitizeNodes(children)
    return {
      backgroundColor: 'transparent',
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(14,19,26,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.3)',
        borderWidth: 1,
        textStyle: { color: isDark ? '#e5e7eb' : '#374151', fontSize: 12 },
        formatter: (p:any) => {
          const d = p.data || {}
          if (d.name === '日主') return '<b>日主</b>'
          const lines = [
            `<div style=\"font-weight:600;color:var(--gold)\">${d.name}</div>`,
            d.labelText ? `<div>对应柱：${d.labelText}</div>` : '',
            d.tenGod ? `<div>代表十神：${d.tenGod}</div>` : ''
          ]
          if (Array.isArray(d.detail) && d.detail.length) {
            const parts = d.detail.slice(0,5).map((x:any)=> `${x[0]}×${Number(x[1]).toFixed(2)}`).join('，')
            lines.push(`<div>构成：${parts}</div>`)
          }
          return lines.join('')
        }
      },
      legend: { show: false },
      series: [{
        type: 'sunburst',
        radius: ['28%','84%'],
        startAngle: 90,
        sort: undefined,
        nodeClick: 'rootToNode',
        emphasis: { focus: 'ancestor' },
        minAngle: 6,
        label: { color: isDark ? '#f9fafb' : '#1f2937', fontSize: 12, fontWeight: 500, rotate: 0, overflow: 'truncate' },
        labelLayout: { hideOverlap: true },
        levels: [
          {},
          { r0: '28%', r: '56%', itemStyle: { borderColor: isDark ? 'rgba(17,24,39,0.35)' : 'rgba(148,163,184,0.25)', borderWidth: 1, shadowBlur: 2, shadowColor: isDark?'rgba(0,0,0,0.25)':'rgba(0,0,0,0.08)' }, label: { overflow: 'truncate', rotate: 0, fontWeight: 600, width: 100 }, labelLayout: { hideOverlap: true } },
          { r0: '56%', r: '84%', itemStyle: { borderColor: isDark ? 'rgba(17,24,39,0.25)' : 'rgba(148,163,184,0.2)', borderWidth: 1 }, label: { overflow: 'truncate', rotate: 0, width: 90 }, labelLayout: { hideOverlap: true } }
        ],
        data: [{ name: '日主', value: 4, itemStyle: { color: '#d4af37' }, children: safeChildren }]
      }]
    }
  }, [data])
  const palaceGraphRef = useEchart(palaceGraphOption)

  // 六亲图使用 Sankey（连线宽度按量化值衡量）
  const kinGraphOption = useMemo(() => {
    if (!data) return { series: [] }
    const isDark = document.documentElement.classList.contains('dark')
    const detail = (data as any).tenGodsDetail || {}
    const tenGods = (data as any).tenGods || {}
    const tenGodsStrength = (data as any).tenGodsStrength || {}
    const buckets: Record<string, number> = { '父母':0, '兄弟':0, '官/夫':0, '财/妻':0, '子女':0 }
    const bucketsScore: Record<string, number> = { '父母':0, '兄弟':0, '官/夫':0, '财/妻':0, '子女':0 }
    const groupOf = (rel: string) => {
      if (!rel) return null
      if (rel.includes('比') || rel.includes('劫')) return '兄弟'
      if (rel.includes('食') || rel.includes('伤')) return '子女'
      if (rel.includes('财')) return '财/妻'
      if (rel.includes('官') || rel.includes('杀')) return '官/夫'
      if (rel.includes('印')) return '父母'
      return null
    }
    const strengthWeight = (lvl: string) => lvl==='strong'?1.3 : lvl==='weak'?0.7 : 1.0
    const pillarWeight: Record<string, number> = { year: 1.05, month: 1.05, day: 1.20, hour: 1.00 }
    const contrib: Record<string, Record<string, number>> = { '父母':{}, '兄弟':{}, '官/夫':{}, '财/妻':{}, '子女':{} }
    ;(['year','month','day','hour'] as const).forEach((k)=>{
      const arr = detail?.[k] || []
      const kWeight = pillarWeight[k]
      arr.forEach((it: any)=> { 
        const rel = String(it.relation||'')
        const g = groupOf(rel)
        if (!g) return
        buckets[g] += 1
        const sLvl = tenGodsStrength[rel] || 'medium'
        const w = 1 * strengthWeight(sLvl) * kWeight
        bucketsScore[g] += w
        contrib[g][rel] = (contrib[g][rel]||0) + w
      })
      // 顶层十神额外权重（代表性更强）
      const topRel = tenGods?.[k]
      const gTop = groupOf(String(topRel||''))
      if (gTop) {
        const sLvlTop = tenGodsStrength[String(topRel)] || 'medium'
        const wTop = 1.5 * strengthWeight(sLvlTop) * kWeight
        bucketsScore[gTop] += wTop
        contrib[gTop][String(topRel)] = (contrib[gTop][String(topRel)]||0) + wTop
      }
    })
    const colorOf: Record<string,string> = {
      '父母': 'rgba(99,102,241,0.95)',
      '兄弟': 'rgba(148,163,184,0.95)',
      '财/妻': 'rgba(212,175,55,0.95)',
      '官/夫': 'rgba(239,68,68,0.95)',
      '子女': 'rgba(16,185,129,0.95)'
    }
    const nodes = [
      { name: '日主', label: { position: 'left', color: isDark ? '#e5e7eb' : '#374151', fontSize: 12, fontWeight: 600 } },
      ...Object.keys(buckets).map(k=> ({ name: k, label: { position: 'right', align: 'left', color: isDark ? '#e5e7eb' : '#374151', fontSize: 12, fontWeight: 500 } }))
    ]
    const minShow = 0.001
    const links = Object.keys(bucketsScore).map(k=> ({ 
      source: '日主', 
      target: k, 
      value: Math.max(minShow, Number(bucketsScore[k].toFixed(3))),
      raw: buckets[k], 
      score: bucketsScore[k],
      detail: Object.entries(contrib[k]).sort((a,b)=> b[1]-a[1]).slice(0,3)
    }))
    const total = Object.values(bucketsScore).reduce((a,b)=> a+b, 0)
    const scale = total > 0 ? 100 / total : 0
    const normalizedLinks = links.map(l => ({ ...l, value: Math.max(minShow, Number((l.value * scale).toFixed(2))), scoreNorm: (l.score || 0) * scale }))
    const totalNorm = 100
    return {
      backgroundColor: 'transparent',
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      tooltip: {
        trigger: 'item',
        backgroundColor: isDark ? 'rgba(14,19,26,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.3)',
        borderWidth: 1,
        textStyle: { color: isDark ? '#e5e7eb' : '#374151', fontSize: 12 },
        formatter: (p:any) => {
          if (p.dataType === 'edge') {
            const score = p.data.score || 0
            const scoreNorm = p.data.scoreNorm || (scale>0 ? score*scale : 0)
            const percent = totalNorm>0 ? (scoreNorm/totalNorm*100).toFixed(1) : '0.0'
            const parts = (p.data.detail||[]).map((x:any)=> `${x[0]}×${x[1].toFixed(2)}`).join('，')
            return `<div style="font-weight:600;color:var(--gold)">${p.data.target}</div>`+
                   `<div>量化值（0-100）：<b>${scoreNorm.toFixed(2)}</b>（${percent}%）</div>`+
                   (parts?`<div class="mt-1">构成：${parts}</div>`:'')
          }
          if (p.dataType === 'node') {
            if (p.name === '日主') return `<div style="font-weight:600;color:var(--gold)">日主</div><div>总计：${total}</div>`
            const score = bucketsScore[p.name] || 0
            const scoreNorm = scale>0 ? score*scale : 0
            const percent = totalNorm>0 ? (scoreNorm/totalNorm*100).toFixed(1) : '0.0'
            return `<div style="font-weight:600;color:var(--gold)">${p.name}</div><div>量化值（0-100）：${scoreNorm.toFixed(2)}（${percent}%）</div>`
          }
          return ''
        }
      },
      legend: { show: false },
      series: [{
        type: 'sankey',
        left: 28, right: 76, top: 12, bottom: 12,
        nodeGap: 16,
        nodeWidth: 16,
        nodeAlign: 'justify',
        orient: 'horizontal',
        draggable: false,
        emphasis: { focus: 'adjacency' },
        label: { color: isDark ? '#f9fafb' : '#1f2937', fontSize: 12, overflow: 'breakAll' },
        itemStyle: { borderWidth: 0, borderRadius: 3 },
        lineStyle: { color: 'source', curveness: 0.45, opacity: 0.88 },
        data: nodes,
        links: normalizedLinks.map(l=> ({ ...l, lineStyle: { color: colorOf[l.target as keyof typeof colorOf] || '#94a3b8', opacity: 0.95 } }))
      }]
    }
  }, [data])
  const kinGraphRef = useEchart(kinGraphOption)

  // 紫微命盘（标准12宫布局）- 使用 ECharts Custom Series 绘制高质感栅格
  const ziweiOption = useMemo(() => {
    if (!data) return { series: [] }
    const isDark = document.documentElement.classList.contains('dark')
    const natalPalaces = (data as any).ziwei?.palaces
    const transitPalaces = (zwTransit as any)?.palaces
    const normalize = (arr:any) => (Array.isArray(arr) && arr.length>0
      ? arr.map((p:any)=> ({ key:String(p?.key||''), name:String(p?.name||''), branch:String(p?.branch||''), stars: Array.isArray(p?.stars)?p.stars:[] }))
      : null)
    const basePalaces = normalize(natalPalaces) || []
    const overlayPalaces = zwTransitTab!=='natal' ? normalize(transitPalaces) : null
    const palaceData = basePalaces
    const palaceNames = Array.isArray(basePalaces)
      ? basePalaces.map((p:any)=> String(p?.name || ''))
      : []
    // 4x4 外环布局（中间2x2留白）- 顺时针从左上开始
    const layout = [
      { r:0, c:0 },{ r:0, c:1 },{ r:0, c:2 },{ r:0, c:3 },
      { r:1, c:3 },{ r:2, c:3 },
      { r:3, c:3 },{ r:3, c:2 },{ r:3, c:1 },{ r:3, c:0 },
      { r:2, c:0 },{ r:1, c:0 }
    ]
    const cell = { w: 1/4, h: 1/4 }
    // 直接基于 isDark 映射主题色，确保切换时立即生效
    const bg = isDark ? '#0e131a' : '#ffffff'
    // 明色主题采用与全局风格契合的金色边框
    const border = isDark ? 'rgba(212,175,55,0.35)' : 'rgba(184,134,11,0.45)'
    const titleColor = isDark ? '#e5e7eb' : '#0f172a'
    const subColor = isDark ? 'rgba(148,163,184,0.9)' : 'rgba(71,85,105,0.9)'
    const colorOfType: Record<ZiweiStarType,string> = {
      main: '#ffd166',
      assist: '#a3e635',
      transform: '#60a5fa',
      misc: isDark ? '#cbd5e1' : '#475569'
    }
    const series: any = {
      type: 'custom',
      coordinateSystem: 'none',
      renderItem: (_params: any, api: any) => {
        let idx = Number(api.value(0))
        if (!Number.isFinite(idx)) idx = 0
        const rc = layout[idx]
        if (!rc) return { type: 'group', children: [] } as any
        const W = api.getWidth(); const H = api.getHeight()
        // 将单元间距平均分配到左右/上下，避免右下角被裁切
        const pad = Math.min(W, H) * 0.02
        const cw = W * cell.w; const ch = H * cell.h
        const x = rc.c * cw + pad * 0.5
        const y = rc.r * ch + pad * 0.5
        const w = cw - pad; const h = ch - pad
        const name = (palaceNames && palaceNames[idx]) ? palaceNames[idx] : ''
        const palObj = (Array.isArray(basePalaces) && (basePalaces as any)[idx]) ? (basePalaces as any)[idx] : null
        const branch = palObj?.branch ? String(palObj.branch) : ''
        const starsAtPal: { name:string; type: ZiweiStarType }[] = Array.isArray(palObj?.stars) ? palObj.stars : []
        const isShen = Array.isArray(starsAtPal) && starsAtPal.some((s:any)=> String(s?.name)==='身宫')
        const title = `${name}${branch ? `（${branch}${isShen?'·身':''}）` : (isShen ? '（身）' : '')}`
        const focus = typeof zwFocus === 'number' ? zwFocus : null
        const tri = Array.isArray((data as any).ziwei?.meta?.triSquares) ? (data as any).ziwei.meta.triSquares : null
        const setOf = (i:number) => new Set(Array.isArray(tri) && Array.isArray(tri[i]) ? tri[i] : [i, (i+4)%12, (i+8)%12, (i+6)%12])
        const highlight = focus!=null ? setOf(focus) : null
        const isInFocus = focus!=null && highlight?.has(idx)
        const group:any = {
          type: 'group',
          // 裁剪到宫位矩形，避免任何内容溢出
          clipPath: { type: 'rect', shape: { x, y, width: w, height: h, r: 12 } },
          children: [
            { // 背板（可点击以触发高亮）
              type: 'rect', shape: { x, y, width: w, height: h, r: 12 },
              style: { fill: bg, stroke: border, lineWidth: isDark ? 1 : 0.9, cursor: 'pointer' },
              silent: false
            },
            ...(isInFocus ? [{ type:'rect', shape:{ x:x+3, y:y+3, width:w-6, height:h-6, r:12 }, style:{ stroke:'#d4af37', lineWidth:2, fill:'transparent' }, silent:true }] : []),
            { // 宫名（含地支与身宫标记）
              type: 'text', style: { x: x+12, y: y+10, text: title, fill: titleColor, font: '600 13px "Noto Sans SC", system-ui' }
            },
            ...((): any[] => {
              const safePal = Array.isArray(basePalaces) && basePalaces[idx] ? basePalaces[idx] : { stars: [] }
              const stars: { name: string; type: ZiweiStarType }[] = Array.isArray((safePal as any)?.stars) ? (safePal as any).stars : []
              const rows = Math.max(1, Math.ceil(stars.length / 2))
              const availableTextHeight = Math.max(0, h - 38)
              const lineH = Math.max(14, Math.min(18, availableTextHeight / rows))
              const fsMain = Math.max(12, Math.min(14, lineH - 2))
              const fsMinor = Math.max(11, Math.min(13, lineH - 3))
              const baseY = y + 32
              return stars.map((s: { name:string; type: ZiweiStarType }, si: number) => ({
                type: 'text',
                style: {
                  x: x + 12 + (si%2)* (w/2),
                  y: baseY + Math.floor(si/2)*lineH,
                  text: String(s?.name || ''),
                  fill: colorOfType[s.type as ZiweiStarType],
                  font: s.type==='main' ? `600 ${fsMain}px "Noto Sans SC", system-ui` : `${fsMinor}px "Noto Sans SC", system-ui`
                }
              }))
            })()
            ,...((): any[] => {
              if (!Array.isArray(overlayPalaces)) return []
              const pal = (overlayPalaces as any)[idx]
              const list: { name:string; type: ZiweiStarType }[] = Array.isArray(pal?.stars) ? pal.stars : []
              const rows = Math.max(1, Math.ceil(list.length / 2))
              const availableTextHeight = Math.max(0, h - 38)
              const lineH = Math.max(14, Math.min(18, availableTextHeight / rows))
              const fsMain = Math.max(11, Math.min(13, lineH - 3))
              const fsMinor = Math.max(10, Math.min(12, lineH - 4))
              const baseY = y + 32
              return list.map((s: { name:string; type: ZiweiStarType }, si: number) => ({
                type: 'text',
                style: {
                  x: x + 12 + (si%2)* (w/2),
                  y: baseY + Math.floor(si/2)*lineH,
                  text: '· ' + String(s?.name || ''),
                  fill: colorOfType[s.type as ZiweiStarType],
                  opacity: 0.65,
                  font: s.type==='main' ? `500 ${fsMain}px "Noto Sans SC", system-ui` : `${fsMinor}px "Noto Sans SC", system-ui`
                }
              }))
            })()
          ]
        }
        return group
      },
      data: (Array.isArray(palaceData) && palaceData.length===12)
        ? Array.from({ length: 12 }, (_:unknown, i:number)=> [i])
        : []
    }
    return {
      backgroundColor: 'transparent',
      animation: false,
      // 明确指定无坐标系
      coordinateSystem: 'none',
      tooltip: {
        show: true,
        backgroundColor: isDark ? 'rgba(14,19,26,0.95)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(212,175,55,0.3)',
        borderWidth: 1,
        textStyle: { color: isDark ? '#e5e7eb' : '#374151', fontSize: 12 },
        formatter: (p:any) => {
          const raw = Array.isArray(p?.data) ? p.data : []
          const idx = typeof raw[0] === 'number' ? raw[0] : 0
          const pal = (Array.isArray(basePalaces) && basePalaces[idx]) ? (basePalaces as any)[idx] : { name:'', stars:[] }
          const list = Array.isArray((pal as any).stars) ? (pal as any).stars : []
          const chips = list.map((s:any) => {
            const c = colorOfType[(s?.type || 'misc') as ZiweiStarType]
            const n = String(s?.name || '')
            return `<span style=\"display:inline-flex;align-items:center;margin-right:6px;color:${c}\">●</span>${n}`
          }).filter(Boolean).join('、')
          if (Array.isArray(overlayPalaces)) {
            const pal2 = (overlayPalaces as any)[idx] || { stars: [] }
            const list2 = Array.isArray(pal2?.stars) ? pal2.stars : []
            const chips2 = list2.map((s:any) => String(s?.name||'')).filter(Boolean).join('、')
            const tag = `<span class=\"chip\" style=\"margin-left:6px\">${zwTransitTab==='year'?'流年':zwTransitTab==='month'?'流月':zwTransitTab==='day'?'流日':'本命'}<\/span>`
            return `<div style=\"font-weight:600;color:var(--gold)\">${pal.name || ''}</div>`+
                   `<div style=\"margin-top:4px;color:${subColor}\">${chips || '—'}${tag}</div>`+
                   (chips2?`<div style=\"margin-top:2px;opacity:.75\">流：${chips2}</div>`:'')
          }
          return `<div style=\"font-weight:600;color:var(--gold)\">${pal.name || ''}</div>`+
                 `<div style=\"margin-top:4px;color:${subColor}\">${chips || '—'}</div>`
        }
      },
      series: [series]
    }
  }, [data, zwFocus, isDark, zwTransit, zwTransitTab])
  const ziweiRef = useEchart(ziweiOption)

  // 点击高亮三方四正
  useEffect(() => {
    const el = (ziweiRef as any)?.current as HTMLDivElement | null
    if (!el) return
    const chart = echarts.getInstanceByDom(el)
    if (!chart) return
    const handler = (ev: any) => {
      if (Array.isArray(ev?.data) && typeof ev.data[0] === 'number') {
        setZwFocus((prev) => prev === ev.data[0] ? null : ev.data[0])
      }
    }
    chart.on('click', handler)
    return () => { chart.off('click', handler) }
  }, [ziweiRef])

  // 当图谱 Tab 切换时，强制触发对应 ECharts 实例 resize，保证在隐藏->显示后仍然正确居中
  useEffect(() => {
    const tryResize = (refAny: any) => {
      const el = refAny?.current as HTMLDivElement | null
      if (!el) return
      const inst = echarts.getInstanceByDom(el)
      if (inst) inst.resize()
    }
    if (graphTab === 'stem') tryResize(graphRef)
    if (graphTab === 'branch') tryResize(branchGraphRef)
    if (graphTab === 'palace') tryResize(palaceGraphRef)
    if (graphTab === 'kin') tryResize(kinGraphRef)
    if (graphTab === 'ziwei') tryResize(ziweiRef)
  }, [graphTab])

  const [timeline, setTimeline] = useState<{ month:number; pillar:string }[] | null>(null)
  function getApiBase() {
    const raw = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001'
    const noTrail = String(raw).replace(/\/$/, '')
    return noTrail.replace(/\/api$/i, '')
  }
  useEffect(()=>{
    const base = getApiBase()
    const y = new Date().getFullYear()
    axios.get(base + '/api/timeline/' + y).then(r=> setTimeline(r.data.months)).catch(()=>{})
  },[])

  async function loadZiweiTransit() {
    try {
      const base = getApiBase()
      const payload: any = {
        datetime: new Date(zwTransitDate).toISOString(),
        timezone: form.timezone
      }
      const resp = await axios.post(base + '/api/ziwei/transit', payload)
      setZwTransit(resp.data?.base || null)
    } catch (_) {
      setZwTransit(null)
    }
  }

  // 当切换到紫微 + 选择流年/月/日时自动加载
  useEffect(() => {
    if (graphTab === 'ziwei' && zwTransitTab !== 'natal') {
      loadZiweiTransit()
    }
  }, [graphTab, zwTransitTab, zwTransitDate, form.timezone])

  // URL 查询参数同步（zt: natal/year/month/day, zd: datetime-local）
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search)
      const zt = qs.get('zt')
      const zd = qs.get('zd')
      if (zt && ['natal','year','month','day'].includes(zt)) {
        setZwTransitTab(zt as any)
      }
      if (zd) {
        setZwTransitDate(zd)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const qs = url.searchParams
      qs.set('zt', zwTransitTab)
      qs.set('zd', zwTransitDate)
      window.history.replaceState({}, '', `${url.pathname}?${qs.toString()}`)
    } catch {}
  }, [zwTransitTab, zwTransitDate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      let iso = new Date(form.datetime).toISOString()
      if (calendar === 'lunar') {
        const base = getApiBase()
        const y = parseInt(lunar.year, 10), m = parseInt(lunar.month, 10), d = parseInt(lunar.day, 10)
        const hh = parseInt(lunar.hour || '0', 10) || 0
        const mm = parseInt(lunar.minute || '0', 10) || 0
        if (!y || !m || !d) throw new Error('请输入有效的农历年月日')
        const resp = await axios.post(base + '/api/convert-lunar', { lunar: { year: y, month: m, day: d, isLeap: !!lunar.isLeap, hour: hh, minute: mm, second: 0 }, timezone: form.timezone })
        iso = resp.data?.iso || iso
      }
      const payload: any = {
        datetime: iso,
        timezone: form.timezone,
        gender: form.gender,
        useTrueSolarTime: form.useTrueSolarTime || undefined
      }
      if (form.useTrueSolarTime) {
        const lat = parseFloat(form.lat)
        const lon = parseFloat(form.lon)
        const latOk = !Number.isNaN(lat) && lat >= -90 && lat <= 90
        const lonOk = !Number.isNaN(lon) && lon >= -180 && lon <= 180
        if (latOk && lonOk) {
          payload.useTrueSolarTime = true
          payload.location = { lat, lon }
        } else {
          throw new Error('真太阳时开启时，请输入有效经纬度（纬度 -90~90， 经度 -180~180）')
        }
      }
      const base = getApiBase()
      const resp = await axios.post(base + '/api/bazi', payload)
      setData(resp.data)
      // auto save profile
      const p: Profile = { id: `${Date.now()}`, datetime: form.datetime, timezone: form.timezone, gender: form.gender, createdAt: Date.now() }
      const next = [p, ...profiles].slice(0, 20)
      setProfiles(next)
      localStorage.setItem(LS_KEY, JSON.stringify(next))
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || '请求失败'
      setError(String(msg))
      console.error('Bazi request error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function exportPDF() {
    const container = document.body
    const canvas = await html2canvas(container as HTMLElement, { backgroundColor: '#0b0f14', scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = (canvas.height * pageWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight)
    pdf.save('destiny-bazi.pdf')
  }

  function loadProfile(p: Profile) {
    setForm(prev => ({
      ...prev,
      datetime: p.datetime,
      timezone: p.timezone,
      gender: p.gender
    }))
    setData(null)
  }

  function clearHistory() {
    setProfiles([])
    localStorage.removeItem(LS_KEY)
  }

  return (
    <div className="min-h-screen">
      <header className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-xl tracking-widest gold">DESTINY · {t('title')}</h1>
        <div className="flex items-center gap-3">
          <button onClick={exportPDF} className="btn text-xs">{t('export')}</button>
          <button onClick={() => setIsDark(v=>!v)} className="btn text-xs" title={t('theme')}>
            {isDark ? t('dark') : t('light')}
          </button>
          <select value={lang} onChange={e=>setLang(e.target.value as any)} className="select text-xs">
            <option value="zh">中文</option>
            <option value="en">EN</option>
          </select>
        </div>
      </header>

      <main className="px-10 py-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm text-gray-300">{t('input')}</h2>
          <form className="space-y-3" onSubmit={onSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="grid grid-cols-2 gap-2">
            <div>
                <label className="block text-xs muted mb-1">{t('calendar')}</label>
                <select className="w-full select" value={calendar} onChange={e=>setCalendar(e.target.value as any)}>
                  <option value="gregorian">{t('gregorian')}</option>
                  <option value="lunar">{t('lunar')}</option>
                </select>
            </div>
            <div>
              <label className="block text-xs muted mb-1">{t('timezone')}</label>
                <div className="flex gap-2">
                  <input className="w-full input tz-input" placeholder="Asia/Shanghai" value={form.timezone}
                    onChange={e=>setForm(prev=>({ ...prev, timezone: e.target.value }))} onClick={()=>setShowTzMap(true)} readOnly />
                  <button type="button" className="btn text-xs" onClick={()=>setShowTzMap(true)}>{t('tzPickOnMap')}</button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs muted mb-1">{t('datetime')}</label>
              <div className="input-group">
                <span className="icon">📅</span>
                {(() => {
                  const LunarInput = forwardRef<HTMLInputElement, any>(({ value, onClick }, ref) => (
                    <input ref={ref} onClick={onClick} readOnly className="w-full input date-input" value={value || ''} placeholder="选择日期" />
                  ))
                  const commonProps = {
                    showTimeSelect: true,
                    timeIntervals: 15,
                    dateFormat: 'yyyy-MM-dd HH:mm',
                    calendarStartDay: 1 as const,
                    showMonthDropdown: true,
                    showYearDropdown: true,
                    dropdownMode: 'select' as const
                  }
                  if (calendar === 'gregorian') {
                    return (
                      <DatePicker
                        selected={gregDate}
                        onChange={(d: Date|null) => {
                          const val = d || new Date()
                          setGregDate(val)
                          const local = new Date(val.getTime() - val.getTimezoneOffset() * 60000).toISOString().slice(0,16)
                          setForm(prev=>({ ...prev, datetime: local }))
                        }}
                        className="w-full input date-input"
                        {...commonProps}
                      />
                    )
                  }
                  // lunar mode — use the same picker UI for quick month/year switch, but interpret the picked Y/M/D/H/m as LUNAR values
                  const display = `农历 ${lunar.year}-${lunar.month}-${lunar.day}${lunar.isLeap?'(闰)':''} ${String(lunar.hour).padStart(2,'0')}:${String(lunar.minute).padStart(2,'0')}`
                  return (
                    <DatePicker
                      selected={gregDate}
                      onChange={async (d: Date|null) => {
                        const val = d || new Date()
                        setGregDate(val)
                        // Interpret picker selection as lunar Y/M/D/H/m directly
                        const ly = val.getFullYear()
                        const lm = val.getMonth() + 1
                        const ld = val.getDate()
                        const hh = val.getHours()
                        const mm = val.getMinutes()
                        setLunar({ year: String(ly), month: String(lm), day: String(ld), isLeap: Boolean(lunar.isLeap), hour: String(hh), minute: String(mm) })
                        try {
                          const base = getApiBase()
                          const rr = await axios.post(base + '/api/convert-lunar', { lunar: { year: ly, month: lm, day: ld, isLeap: Boolean(lunar.isLeap), hour: hh, minute: mm, second: 0 }, timezone: form.timezone })
                          const iso = String(rr.data?.iso || '')
                          if (iso) {
                            setLunarDerivedISO(iso)
                            setForm(prev=>({ ...prev, datetime: iso.slice(0,16) }))
                          }
                        } catch {}
                      }}
                      customInput={<LunarInput value={display} />}
                      {...commonProps}
                    />
                  )
                })()}
              </div>
              {calendar === 'lunar' && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="text-[11px] muted">对应公历：{lunarDerivedISO ? new Date(lunarDerivedISO).toLocaleString() : '—'}</div>
                  <label className="text-[11px] muted flex items-center gap-1">
                    <input type="checkbox" className="h-4 w-4" checked={lunar.isLeap} onChange={async (e)=>{
                      const isLeap = e.target.checked
                      const ly = parseInt(lunar.year, 10) || new Date().getFullYear()
                      const lm = parseInt(lunar.month, 10) || 1
                      const ld = parseInt(lunar.day, 10) || 1
                      const hh = parseInt(lunar.hour||'0', 10) || 0
                      const mm = parseInt(lunar.minute||'0', 10) || 0
                      setLunar(p=>({ ...p, isLeap }))
                      try {
                        const base = getApiBase()
                        const rr = await axios.post(base + '/api/convert-lunar', { lunar: { year: ly, month: lm, day: ld, isLeap, hour: hh, minute: mm, second: 0 }, timezone: form.timezone })
                        const iso = String(rr.data?.iso || '')
                        if (iso) {
                          setLunarDerivedISO(iso)
                          setForm(prev=>({ ...prev, datetime: iso.slice(0,16) }))
                        }
                      } catch {}
                    }} /> 闰月
                  </label>
                </div>
              )}
            </div>
            {/* 农历模式不再展示自定义面板，统一使用上方日期控件并在提交时转换 */}
            <div className="flex items-center gap-2">
              <input id="trueSolar" type="checkbox" className="h-4 w-4" checked={form.useTrueSolarTime}
                onChange={e=>setForm(prev=>({ ...prev, useTrueSolarTime: e.target.checked }))} />
              <label htmlFor="trueSolar" className="text-xs muted">{t('trueSolar')}</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs muted mb-1">{t('latitude')}</label>
                <div className="flex gap-2">
                <input className="w-full input" placeholder="31.23" value={form.lat}
                  onChange={e=>setForm(prev=>({ ...prev, lat: e.target.value }))} disabled={!form.useTrueSolarTime} />
                  <button type="button" className="btn text-xs" onClick={()=> setShowCoordMap(true)} disabled={!form.useTrueSolarTime}>{t('coordPickOnMap')}</button>
                </div>
              </div>
              <div>
                <label className="block text-xs muted mb-1">{t('longitude')}</label>
                <input className="w-full input" placeholder="121.47" value={form.lon}
                  onChange={e=>setForm(prev=>({ ...prev, lon: e.target.value }))} disabled={!form.useTrueSolarTime} />
              </div>
            </div>
            <div>
              <label className="block text-xs muted mb-1">{t('gender')}</label>
              <select className="w-full select" value={form.gender}
                onChange={e=>setForm(prev=>({ ...prev, gender: e.target.value }))}>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button disabled={loading} className="flex-1 btn btn-primary mt-2">{loading ? t('calculating') : t('submit')}</button>
              <button type="button" onClick={() => {
                const p: Profile = { id: `${Date.now()}`, datetime: form.datetime, timezone: form.timezone, gender: form.gender, createdAt: Date.now() }
                const next = [p, ...profiles].slice(0, 20)
                setProfiles(next)
                localStorage.setItem(LS_KEY, JSON.stringify(next))
              }} className="btn text-xs mt-2">{t('save')}</button>
            </div>
          </form>
          {/* Timezone map modal */}
          {showTzMap && (
            <div className="modal-backdrop" onClick={()=>setShowTzMap(false)}>
              <div className="modal" onClick={e=>e.stopPropagation()}>
                <div className="modal-header">
                  <div className="text-sm">{t('timezone')} / {t('tzPickOnMap')}</div>
                  <button className="btn text-xs" onClick={()=>setShowTzMap(false)}>✕</button>
                </div>
                <div className="modal-body">
                  <div ref={tzMapRef} style={{ width:'100%', height: 320, borderRadius: 8 }} />
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs">{tzCandidate ? `已选择：${tzCandidate}` : '点击地图选择时区（按经度近似）'}</div>
                    <div className="flex gap-2">
                      <button className="btn text-xs" onClick={()=> setTzCandidate(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai')}>使用本机</button>
                      <button className="btn btn-primary text-xs" disabled={!tzCandidate} onClick={()=> { if (tzCandidate) { setForm(p=>({ ...p, timezone: tzCandidate })); setShowTzMap(false); } }}>应用</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Coordinate pick modal */}
          {showCoordMap && (
            <div className="modal-backdrop" onClick={()=>setShowCoordMap(false)}>
              <div className="modal" onClick={e=>e.stopPropagation()}>
                <div className="modal-header">
                  <div className="text-sm">{t('coordPickOnMap')}</div>
                  <button className="btn text-xs" onClick={()=>setShowCoordMap(false)}>✕</button>
                </div>
                <div className="modal-body">
                  <div ref={coordMapRef} style={{ width:'100%', height: 360, borderRadius: 8 }} />
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs">{coordCandidate ? `坐标：${coordCandidate.lat}, ${coordCandidate.lon}` : '点击世界地图设置经纬度（等矩形近似）'}</div>
                    <div className="flex gap-2">
                      <button className="btn btn-primary text-xs" disabled={!coordCandidate} onClick={()=> {
                        if (coordCandidate) {
                          setForm(p=>({ ...p, lat: String(coordCandidate.lat), lon: String(coordCandidate.lon) }));
                          setShowCoordMap(false)
                        }
                      }}>应用</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {profiles.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs text-gray-400">{t('history')}</h3>
                <button onClick={clearHistory} className="text-[10px] text-gray-400">清空</button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {profiles.map(p => (
                  <div key={p.id} className="list-item">
                    <div className="text-xs muted">{p.datetime.replace('T',' ')}</div>
                    <div className="flex items-center gap-2">
                      <span className="chip">{p.gender==='male'?'男':'女'}</span>
                      <button onClick={()=>loadProfile(p)} className="btn text-[10px] px-2 py-0.5">加载</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card card-stretch p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm muted">{t('five')}</h2>
            {data && (
              <div className="text-[11px] muted flex gap-2">
                <span className="chip" style={{ color: ELEMENT_COLOR.wood }}>木 {data.fiveElementPower.wood.toFixed(2)}</span>
                <span className="chip" style={{ color: ELEMENT_COLOR.fire }}>火 {data.fiveElementPower.fire.toFixed(2)}</span>
                <span className="chip" style={{ color: ELEMENT_COLOR.earth }}>土 {data.fiveElementPower.earth.toFixed(2)}</span>
                <span className="chip" style={{ color: ELEMENT_COLOR.metal }}>金 {data.fiveElementPower.metal.toFixed(2)}</span>
                <span className="chip" style={{ color: ELEMENT_COLOR.water }}>水 {data.fiveElementPower.water.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="radar-box">
            <div ref={enhancedRadarRef} style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="panel-note-fixed text-xs muted">
            提示：鼠标悬停查看各项具体数值；"木/火/土/金/水"分别对应生发/炎上/稼穑/肃杀/润下。
          </div>
        </section>

        {data && (
        <section className="card p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm muted">{t('bazi')}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            {[
              {label:'年柱', p:data.year},
              {label:'月柱', p:data.month},
              {label:'日柱', p:data.day},
              {label:'时柱', p:data.hour}
            ].map((x,i)=> {
              const elMap: Record<string,string> = { '甲':'wood','乙':'wood','丙':'fire','丁':'fire','戊':'earth','己':'earth','庚':'metal','辛':'metal','壬':'water','癸':'water' }
              const el = elMap[x.p.heavenlyStem] || 'earth'
              return (
              <div key={i} className="p-5 rounded-card pillar-card pillar" data-el={el}>
                <div className="flex items-center justify-between mb-1">
                  <div className="pillar-tag">{x.label}</div>
                  <span className="pillar-badge" data-el={el}>{(ELEMENT_CN as any)[el] || el}</span>
                </div>
                <div className="pillar-han text-3xl tracking-widest tooltip">
                  <span style={{ color: ELEMENT_COLOR[el] }}>{x.p.heavenlyStem}</span>
                  <span style={{ color: ELEMENT_COLOR[BRANCH_ELEMENT[x.p.earthlyBranch] || 'earth'] }}>{x.p.earthlyBranch}</span>
                  <div className="tooltip-content text-left">
                    <div>纳音：{x.p.naYin || '-'}</div>
                    <div>藏干：{(x.p.hiddenStems||[]).join('、') || '-'}</div>
                  </div>
                </div>
              </div>
            )})}
          </div>
          {/* 大运展示移动至"星运"卡片 */}
          {/* 日主/强弱/喜用/忌讳 移至下方命盘细则区统一排序展示 */}

          {/* 命盘细则顺序：藏干、十神、日主、强弱、喜用、忌讳、星运、自坐、空亡、纳音、神煞、干系图 */}
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {/* 十神（提前展示） */}
            <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2 tooltip">十神
                <div className="tooltip-content">以日主为中心的十种关系：比劫、食伤、财、官杀、印，阴阳与生克决定具体称谓。</div>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center text-sm">
                <div>
                  <div className="text-[10px] muted">年</div>
                  <div>
                    {(data as any).tenGods?.year || '-'}
                    { (data as any).tenGodsStrength && (data as any).tenGods?.year && (()=>{
                      const lvl = (data as any).tenGodsStrength[(data as any).tenGods.year] || 'medium'
                      const txt = lvl==='strong'?'强':(lvl==='weak'?'弱':'中')
                      const tip = lvl==='strong'?'偏旺（强）':(lvl==='weak'?'偏弱（弱）':'中等（中）')
                      return (
                        <span className="tooltip">
                          <span className={`ml-2 badge badge-${lvl}`}>{txt}</span>
                          <div className="tooltip-content">{tip}</div>
                        </span>
                      )
                    })()}
                  </div>
                  <div className="text-[11px] muted mt-1">{(data as any).tenGodsDetail?.year?.map((d:any)=>`${d.stem}${d.relation}`).join('、')||''}</div>
                </div>
                <div>
                  <div className="text-[10px] muted">月</div>
                  <div>
                    {(data as any).tenGods?.month || '-'}
                    { (data as any).tenGodsStrength && (data as any).tenGods?.month && (()=>{
                      const lvl = (data as any).tenGodsStrength[(data as any).tenGods.month] || 'medium'
                      const txt = lvl==='strong'?'强':(lvl==='weak'?'弱':'中')
                      const tip = lvl==='strong'?'偏旺（强）':(lvl==='weak'?'偏弱（弱）':'中等（中）')
                      return (
                        <span className="tooltip">
                          <span className={`ml-2 badge badge-${lvl}`}>{txt}</span>
                          <div className="tooltip-content">{tip}</div>
                        </span>
                      )
                    })()}
                  </div>
                  <div className="text-[11px] muted mt-1">{(data as any).tenGodsDetail?.month?.map((d:any)=>`${d.stem}${d.relation}`).join('、')||''}</div>
                </div>
                <div>
                  <div className="text-[10px] muted">日</div>
                  <div>
                    日主
                    { (data as any).advice && (()=>{
                      const lvlRaw = ((data as any).advice.strength || 'balanced') as 'weak'|'balanced'|'strong'
                      const lvl = lvlRaw==='balanced' ? 'medium' : lvlRaw
                      const txt = lvl==='strong'?'强':(lvl==='weak'?'弱':'中')
                      const tip = lvl==='strong'?'偏旺（强）':(lvl==='weak'?'偏弱（弱）':'中等（中）')
                      return (
                        <span className="tooltip">
                          <span className={`ml-2 badge badge-${lvl}`}>{txt}</span>
                          <div className="tooltip-content">{tip}</div>
                        </span>
                      )
                    })()}
                  </div>
                  <div className="text-[11px] muted mt-1">{(data as any).tenGodsDetail?.day?.map((d:any)=>`${d.stem}${d.relation}`).join('、')||''}</div>
                </div>
                <div>
                  <div className="text-[10px] muted">时</div>
                  <div>
                    {(data as any).tenGods?.hour || '-'}
                    { (data as any).tenGodsStrength && (data as any).tenGods?.hour && (()=>{
                      const lvl = (data as any).tenGodsStrength[(data as any).tenGods.hour] || 'medium'
                      const txt = lvl==='strong'?'强':(lvl==='weak'?'弱':'中')
                      const tip = lvl==='strong'?'偏旺（强）':(lvl==='weak'?'偏弱（弱）':'中等（中）')
                      return (
                        <span className="tooltip">
                          <span className={`ml-2 badge badge-${lvl}`}>{txt}</span>
                          <div className="tooltip-content">{tip}</div>
                        </span>
                      )
                    })()}
                  </div>
                  <div className="text-[11px] muted mt-1">{(data as any).tenGodsDetail?.hour?.map((d:any)=>`${d.stem}${d.relation}`).join('、')||''}</div>
                </div>
              </div>
            </div>
            {/* 藏干（移到十神之后） */}
            <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2">藏干</div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div><div className="text-[10px] muted">年</div><div>{(data.year.hiddenStems||[]).join('、') || '-'}</div></div>
                <div><div className="text-[10px] muted">月</div><div>{(data.month.hiddenStems||[]).join('、') || '-'}</div></div>
                <div><div className="text-[10px] muted">日</div><div>{(data.day.hiddenStems||[]).join('、') || '-'}</div></div>
                <div><div className="text-[10px] muted">时</div><div>{(data.hour.hiddenStems||[]).join('、') || '-'}</div></div>
              </div>
            </div>
            {/* 日主/强弱/喜用/忌讳 四个独立卡片同排（在此包一层栅格，不增加卡片边框） */}
            <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]"><div className="text-xs muted mb-1">日主</div><div className="text-lg text-center"><span style={{ color: ELEMENT_COLOR[data.advice?.dayMaster.element || 'earth'] || 'var(--gold)' }}>{data.advice?.dayMaster.stem}</span></div></div>
              <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]"><div className="text-xs muted mb-1">强弱</div><div className="text-sm text-center"><span className="tooltip inline-block">{data.advice?.strength==='weak'?'偏弱':data.advice?.strength==='strong'?'偏旺':'中和'}<div className="tooltip-content">{data.advice?.notes}</div></span></div></div>
              <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]"><div className="text-xs muted mb-1">喜用</div><div className="text-sm text-center">{(data.advice?.favorable||[]).map(e=>ELEMENT_CN[e]||e).join('、')}</div></div>
              <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]"><div className="text-xs muted mb-1">忌讳</div><div className="text-sm text-center">{(data.advice?.avoid||[]).length>0 ? (data.advice?.avoid||[]).map(e=>ELEMENT_CN[e]||e).join('、') : '无'}</div></div>
            </div>
            {/* 星运（各柱天干对本柱地支的十二长生） */}
            <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2 tooltip">星运
                <div className="tooltip-content">各柱天干对本柱地支的十二长生状态，反映该柱自身的旺衰。</div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                {([
                  {label:'年', stem: data.year.heavenlyStem, branch: data.year.earthlyBranch},
                  {label:'月', stem: data.month.heavenlyStem, branch: data.month.earthlyBranch},
                  {label:'日', stem: data.day.heavenlyStem, branch: data.day.earthlyBranch},
                  {label:'时', stem: data.hour.heavenlyStem, branch: data.hour.earthlyBranch}
                ] as any[]).map((x,i)=> {
                  const stage = changShengOf(x.stem, x.branch);
                  return (
                    <div key={i}>
                      <div className="text-[10px] muted">{x.label}</div>
                      <div className="tooltip inline-block">
                        {stage || '—'}
                        {stage && (
                          <div className="tooltip-content">
                            <div className="font-semibold">{x.stem}干在{x.branch}支：{stage}</div>
                            <div className="mt-1">{CHANGSHENG_DESC[stage] || stage}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 自坐：十二长生基于日主天干对本柱地支 */}
            <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2 tooltip">自坐
                <div className="tooltip-content">以日主为基准，分别查看四柱与日主之间的十二长生阶段。</div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                {[
                  {label:'年', branch: data.year.earthlyBranch},
                  {label:'月', branch: data.month.earthlyBranch},
                  {label:'日', branch: data.day.earthlyBranch},
                  {label:'时', branch: data.hour.earthlyBranch}
                ].map((x, i) => {
                  const stage = changShengOf(data.day.heavenlyStem, x.branch);
                  return (
                    <div key={i}>
                      <div className="text-[10px] muted">{x.label}</div>
                      <div className="tooltip inline-block">
                        {stage || '—'}
                        {stage && (
                          <div className="tooltip-content">
                            <div className="font-semibold">日主{data.day.heavenlyStem}在{x.branch}支：{stage}</div>
                            <div className="mt-1">{CHANGSHENG_DESC[stage] || stage}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 空亡（唯一）放在此处 */}
            <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2 tooltip">空亡
                <div className="tooltip-content">{NOTE_XUNKONG}</div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                {[
                  { label: '年', pillar: data.year, xunKong: (data as any).xunKong?.year || [] },
                  { label: '月', pillar: data.month, xunKong: (data as any).xunKong?.month || [] },
                  { label: '日', pillar: data.day, xunKong: (data as any).xunKong?.day || [] },
                  { label: '时', pillar: data.hour, xunKong: (data as any).xunKong?.hour || [] }
                ].map((item, i) => {
                  const isEmpty = item.xunKong.includes(item.pillar.earthlyBranch);
                  const emptyBranches = item.xunKong;
                  return (
                    <div key={i}>
                      <div className="text-[10px] muted">{item.label}</div>
                      <div className="tooltip inline-block">
                        <div className="flex gap-1 justify-center">
                          {emptyBranches.map((branch: string, j: number) => (
                            <span 
                              key={j} 
                              className={`text-xs px-1 py-0.5 rounded border ${
                                branch === item.pillar.earthlyBranch 
                                  ? 'bg-red-500/20 border-red-500/50 text-red-400 font-bold' 
                                  : 'border-gray-600 text-gray-400'
                              }`}
                            >
                              {branch}
                            </span>
                          ))}
                        </div>
                        <div className="tooltip-content">
                          <div>本柱空亡：{emptyBranches.join('、')}</div>
                          {isEmpty && <div className="mt-1">{XUNKONG_DESC[item.pillar.earthlyBranch] || `${item.pillar.earthlyBranch}支空亡，力量减弱`}</div>}
                          {!isEmpty && <div className="mt-1">本柱地支不逢空亡，力量正常</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 纳音 */}
              <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2 tooltip">纳音
                <div className="tooltip-content">{NOTE_NAYIN}</div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <div className="text-[10px] muted">年</div>
                  <div className="tooltip inline-block">
                    {data.year.naYin || '-'}
                    <div className="tooltip-content">{NAYIN_DESC[data.year.naYin] || data.year.naYin || '-'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] muted">月</div>
                  <div className="tooltip inline-block">
                    {data.month.naYin || '-'}
                    <div className="tooltip-content">{NAYIN_DESC[data.month.naYin] || data.month.naYin || '-'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] muted">日</div>
                  <div className="tooltip inline-block">
                    {data.day.naYin || '-'}
                    <div className="tooltip-content">{NAYIN_DESC[data.day.naYin] || data.day.naYin || '-'}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] muted">时</div>
                  <div className="tooltip inline-block">
                    {data.hour.naYin || '-'}
                    <div className="tooltip-content">{NAYIN_DESC[data.hour.naYin] || data.hour.naYin || '-'}</div>
                  </div>
                </div>
              </div>
            </div>
            {/* 删除重复的空亡卡片 */}
            {(() => {
              const pillars = [data.year, data.month, data.day, data.hour].map(p=>({ branch: p.earthlyBranch }))
              const localStars = computeShenShaPositions(pillars, data.day.earthlyBranch)
              const merged = new Map<string, Set<string>>()
              const add = (name:string, hits:string[]) => {
                if (!merged.has(name)) merged.set(name, new Set())
                const s = merged.get(name)!
                hits.forEach(h => s.add(h))
              }
              localStars.forEach(s => add(s.name, s.hits))
              ;(data.stars||[]).forEach(s => add(s.name, s.hits))
              const shensha = Array.from(merged.entries()).map(([name, set]) => ({
                name,
                hits: Array.from(set),
                group: (data.stars||[]).find((x:any)=>x.name===name)?.group || (['天乙贵人','文昌'].includes(name)?'贵人':['羊刃'].includes(name)?'煞曜':'吉曜')
              }))
              const groupVariant = (g:string) => g==='贵人'?'good':(g==='煞曜'?'evil':'neutral')
              const byPillar: Record<'年'|'月'|'日'|'时', { name:string; group:string }[]> = { '年':[], '月':[], '日':[], '时':[] }
              shensha.forEach(s=> {
                s.hits.forEach(h=> { if ((byPillar as any)[h]) (byPillar as any)[h].push({ name: s.name, group: s.group }) })
              })
              const cols = [
                { label:'年', items: byPillar['年'] },
                { label:'月', items: byPillar['月'] },
                { label:'日', items: byPillar['日'] },
                { label:'时', items: byPillar['时'] }
              ]
              return (
            <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)] md:col-span-2">
                  <div className="text-xs muted mb-2 tooltip">神煞
                    <div className="tooltip-content">
                      <div>颜色含义：</div>
                      <div className="mt-1 flex gap-2 justify-center">
                        <span className="ss-badge ss-sm ss-good">贵人</span>
                        <span className="ss-badge ss-sm ss-neutral">吉曜</span>
                        <span className="ss-badge ss-sm ss-evil">煞曜</span>
                      </div>
                      <div className="text-[11px] muted mt-1">绿=助益，蓝=中性/辅助，红=需制化</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center text-sm">
                    {cols.map((c,i)=> (
                      <div key={i}>
                        <div className="text-[10px] muted">{c.label}</div>
                        <div className="mt-1 flex flex-col items-center gap-2">
                          {c.items.length>0 ? c.items.map((it,j)=> (
                            <span key={j} className={`ss-badge ss-${groupVariant(it.group)} tooltip tooltip-top`}>
                              {it.name}
                              <div className="tooltip-content">{(STAR_DESC as any)[it.name] || it.name}</div>
                          </span>
                          )) : <span className="text-[11px] muted">—</span>}
                        </div>
                      </div>
                    ))}
                    </div>
                </div>
              )
            })()}
            {(data.graph || data.branchGraph) && (
              <div className="p-4 rounded-card bg-[var(--card)] border border-[var(--border)] md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs muted tooltip">智能图谱
                    <div className="tooltip-content">
                      <div>四柱干支关系图，显示生克合冲等关系</div>
                      <div className="mt-1">关系强弱影响命局平衡与格局高低</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setGraphTab('stem')}
                      className={`text-xs px-2 py-1 rounded ${graphTab==='stem' ? 'bg-gold text-black' : 'text-muted hover:text-fg'}`}
                    >
                      天干
                    </button>
                    <button 
                      onClick={() => setGraphTab('branch')}
                      className={`text-xs px-2 py-1 rounded ${graphTab==='branch' ? 'bg-gold text-black' : 'text-muted hover:text-fg'}`}
                    >
                      地支
                    </button>
                    <button 
                      onClick={() => setGraphTab('palace')}
                      className={`text-xs px-2 py-1 rounded ${graphTab==='palace' ? 'bg-gold text-black' : 'text-muted hover:text-fg'}`}
                    >
                      宫位
                    </button>
                    <button 
                      onClick={() => setGraphTab('kin')}
                      className={`text-xs px-2 py-1 rounded ${graphTab==='kin' ? 'bg-gold text-black' : 'text-muted hover:text-fg'}`}
                    >
                      六亲
                    </button>
                    <button 
                      onClick={() => setGraphTab('ziwei')}
                      className={`text-xs px-2 py-1 rounded ${graphTab==='ziwei' ? 'bg-gold text-black' : 'text-muted hover:text-fg'}`}
                    >
                      紫微
                    </button>
                  </div>
                </div>
                  <div className="w-full" style={{ minHeight: 320, display: 'grid', placeItems: 'center' }}>
                    {graphTab==='ziwei' && (
                      <div className="flex items-center justify-between w-full max-w-[640px] mb-2">
                        <div className="flex items-center gap-2">
                          <button onClick={()=>setZwTransitTab('natal')} className={`text-xs px-2 py-1 rounded ${zwTransitTab==='natal'?'bg-gold text-black':'text-muted hover:text-fg'}`}>本命</button>
                          <button onClick={()=>setZwTransitTab('year')} className={`text-xs px-2 py-1 rounded ${zwTransitTab==='year'?'bg-gold text-black':'text-muted hover:text-fg'}`}>流年</button>
                          <button onClick={()=>setZwTransitTab('month')} className={`text-xs px-2 py-1 rounded ${zwTransitTab==='month'?'bg-gold text-black':'text-muted hover:text-fg'}`}>流月</button>
                          <button onClick={()=>setZwTransitTab('day')} className={`text-xs px-2 py-1 rounded ${zwTransitTab==='day'?'bg-gold text-black':'text-muted hover:text-fg'}`}>流日</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="datetime-local" value={zwTransitDate} onChange={e=>setZwTransitDate(e.target.value)} className="input text-xs" style={{ height: 28, paddingTop: 2, paddingBottom: 2 }} />
                          {zwTransitTab!=='natal' && (
                            <button onClick={loadZiweiTransit} className="btn text-xs">刷新</button>
                          )}
                        </div>
                      </div>
                    )}
                  <div style={{ width: '100%', height: 320, display: graphTab==='stem' ? 'block' : 'none' }}>
                    <div ref={graphRef as any} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={{ width: '100%', height: 320, display: graphTab==='branch' ? 'block' : 'none' }}>
                    <div ref={branchGraphRef as any} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={{ width: '100%', height: 320, display: graphTab==='palace' ? 'block' : 'none' }}>
                    <div ref={palaceGraphRef as any} style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div style={{ width: '100%', height: 320, display: graphTab==='kin' ? 'block' : 'none' }}>
                    <div ref={kinGraphRef as any} style={{ width: '100%', height: '100%' }} />
                  </div>
                    <div style={{ width: '100%', maxWidth: 640, aspectRatio: '1 / 1', height: 'auto', display: graphTab==='ziwei' ? 'block' : 'none' }}>
                      <div ref={ziweiRef as any} style={{ width: '100%', height: '100%' }} />
                    </div>
                </div>
                <div className="text-[11px] muted mt-2">
                  {graphTab==='stem' ? (
                    <div>
                      <div>说明：日柱居中，显示四柱天干间的五行生克关系</div>
                      <div className="mt-1">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded mr-1"></span>生：相生助力
                        <span className="inline-block w-2 h-2 bg-red-500 rounded mr-1 ml-3"></span>克：相克制约
                        <span className="inline-block w-2 h-2 bg-gray-500 rounded mr-1 ml-3"></span>同：同气相求
                      </div>
                    </div>
                  ) : graphTab==='branch' ? (
                    <div>
                      <div>说明：显示四柱地支间的合冲刑害关系</div>
                      <div className="mt-1">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded mr-1"></span>合：六合三合
                        <span className="inline-block w-2 h-2 bg-red-600 rounded mr-1 ml-3"></span>冲：相冲对立
                        <span className="inline-block w-2 h-2 bg-orange-500 rounded mr-1 ml-3"></span>害：相害阻滞
                        <span className="inline-block w-2 h-2 bg-amber-700 rounded mr-1 ml-3"></span>刑：相刑波折
                      </div>
                    </div>
                  ) : graphTab==='palace' ? (
                    <div>
                      <div>说明：以日主为中心，四柱映射至父母/兄弟/夫妻/子女宫位；边标注对应十神。</div>
                      <div className="mt-1">
                        <span className="inline-block w-2 h-2 bg-indigo-500 rounded mr-1"></span>父母
                        <span className="inline-block w-2 h-2 bg-slate-400 rounded mr-1 ml-3"></span>兄弟
                        <span className="inline-block w-2 h-2 bg-amber-400 rounded mr-1 ml-3"></span>财/妻
                        <span className="inline-block w-2 h-2 bg-red-500 rounded mr-1 ml-3"></span>官/夫
                        <span className="inline-block w-2 h-2 bg-emerald-500 rounded mr-1 ml-3"></span>子女
                      </div>
                    </div>
                  ) : graphTab==='kin' ? (
                    <div>
                      <div>说明：六亲强弱为综合量化值（0–100 标准化）。来源：十神明细加权（强/中/弱、年/月/日/时与代表十神权重），连线粗细与颜色体现相对强度。</div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
        )}

        {timeline && (
        <section className="card p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm text-gray-300">{t('chart_months')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
            {timeline.map((m,i)=> (
              <div key={i} className="p-3 rounded border border-[var(--border)] bg-[var(--card)]">
                <div className="text-xs muted">{m.month}月</div>
                <div className="gold text-lg tracking-widest">{m.pillar}</div>
              </div>
            ))}
          </div>
        </section>
        )}
      </main>
    </div>
  )
}


