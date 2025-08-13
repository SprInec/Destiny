import { useMemo, useState } from 'react'
import axios from 'axios'
import * as echarts from 'echarts'
import { useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

type CalcResp = {
  year: any; month: any; day: any; hour: any;
  fiveElementPower: { wood:number; fire:number; earth:number; metal:number; water:number }
  luckCycles: { daYun: { startAge:number; startYear:number; pillar:string }[] }
  advice?: { dayMaster:{ stem:string; element:string }; strength:string; favorable:string[]; avoid:string[]; notes:string }
  graph?: { nodes: { id:string; label:string; kind:string; element:string }[]; edges: { source:string; target:string; relation:string; weight:number }[] }
  stars?: { name: string; hits: string[]; group?: string }[]
}

type Profile = { id: string; datetime: string; timezone: string; gender: string; createdAt: number }

const LS_KEY = 'destiny_profiles'

const ELEMENT_CN: Record<string,string> = { wood:'木', fire:'火', earth:'土', metal:'金', water:'水' }
type ShenSha = '桃花' | '驿马' | '华盖'
const STAR_DESC: Record<string,string> = {
  '桃花': '主异性缘、艺术美感；过旺恐多情泛滥',
  '驿马': '主奔波动迁、应变出行',
  '华盖': '主孤高清雅、学术宗教，易孤寡',
  '天乙贵人': '贵人相助、逢凶化吉',
  '文昌': '主文魁才学、考试利',
  '羊刃': '主果决刚烈，宜制化',
  '红鸾': '主喜庆姻缘',
  '天喜': '主喜庆、人缘和合',
  '禄神': '主禄与俸，食禄之气，利于事业资源与名望',
  '孤辰': '性清独立，宜化合与沟通，忌过分孤高',
  '寡宿': '性静慎独，宜融群体协作，忌闭塞',
  '咸池': '即桃花，主人缘桃色事；随局论吉凶',
  '天德': '阴德护体、逢凶化吉（简表）',
  '月德': '德曜拱照、贵人相扶（简表）'
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

function useEchart(option: any) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chart.setOption(option)
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    // Observe container size changes to keep chart centered when sibling cards change height
    let ro: any = null
    try {
      const R = (window as any).ResizeObserver
      if (R && ref.current) {
        ro = new R(() => { chart.resize() })
        ro.observe(ref.current)
      }
    } catch {}
    return () => { if (ro && ro.disconnect) ro.disconnect(); window.removeEventListener('resize', onResize); chart.dispose() }
  }, [JSON.stringify(option)])
  return ref
}

export function App() {
  const [form, setForm] = useState({ datetime: new Date().toISOString().slice(0,16), timezone: 'Asia/Shanghai', gender: 'male', useTrueSolarTime: false as boolean, lat: '' as string, lon: '' as string })
  const [data, setData] = useState<CalcResp | null>(null)
  const [lang, setLang] = useState<'zh'|'en'>('zh')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
  })
  const [isDark, setIsDark] = useState<boolean>(true)

  const dict = useMemo(() => ({
    zh: {
      title: '八字命理', input: '输入生辰', datetime: '日期时间', timezone: '时区', gender: '性别', male: '男', female: '女',
      submit: '排盘', calculating: '计算中…', five: '五行能量', chart_months: '流月（当年）', bazi: '命盘',
      export: '导出PDF', daymaster: '日主', strength: '强弱', favorable: '喜用', avoid: '忌讳', notes: '说明', history: '历史记录', save: '保存', theme: '主题', light: '明', dark: '暗',
      trueSolar: '真太阳时', latitude: '纬度', longitude: '经度'
    },
    en: {
      title: 'BaZi Analyzer', input: 'Birth Input', datetime: 'Datetime', timezone: 'Timezone', gender: 'Gender', male: 'Male', female: 'Female',
      submit: 'Calculate', calculating: 'Calculating…', five: 'Five Elements', chart_months: 'Months (This Year)', bazi: 'BaZi Board',
      export: 'Export PDF', daymaster: 'Day Master', strength: 'Strength', favorable: 'Favorable', avoid: 'Avoid', notes: 'Notes', history: 'History', save: 'Save', theme: 'Theme', light: 'Light', dark: 'Dark',
      trueSolar: 'True Solar Time', latitude: 'Latitude', longitude: 'Longitude'
    }
  }), [])
  const t = (k: keyof typeof dict['zh']) => (dict as any)[lang][k] || k

  useEffect(() => {
    const root = document.documentElement
    if (isDark) root.classList.add('dark'); else root.classList.remove('dark')
  }, [isDark])

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
        name: { color: textColor },
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

  // graph visualization (stems relation)
  const graphOption = useMemo(() => {
    if (!data?.graph) return { series: [] }
    const palette: Record<string, string> = { wood:'#22c55e', fire:'#ef4444', earth:'#eab308', metal:'#f59e0b', water:'#3b82f6' }
    const edgeColor: Record<string,string> = { '生':'#10b981', '克':'#ef4444', '同':'#64748b' }
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p:any) => {
          if (p.dataType === 'node') return `${p.data.label} · ${p.data.element}`
          if (p.dataType === 'edge') return `${p.data.source} ${p.data.relation} ${p.data.target}`
          return ''
        }
      },
      series: [{
        type: 'graph',
        layout: 'force',
        force: { repulsion: 120, gravity: 0.02, edgeLength: 120 },
        symbolSize: 38,
        roam: false,
        animationDuration: 600,
        animationEasing: 'cubicOut',
        label: { show: true, color: '#0b0f14', fontWeight: 700, backgroundColor: '#fff', padding: [4,6], borderRadius: 6 },
        edgeSymbol: ['circle','arrow'],
        edgeSymbolSize: [4, 10],
        edgeLabel: { show: false },
        emphasis: { focus: 'adjacency' },
        itemStyle: { borderColor: 'var(--border)', borderWidth: 1, shadowBlur: 12, shadowColor: 'rgba(212,175,55,0.12)' },
        lineStyle: { curveness: 0.25, opacity: 0.9 },
        data: data.graph.nodes.map(n => ({
          id: n.id, name: n.id, label: n.label, value: 1,
          element: n.element,
          itemStyle: { color: palette[n.element] || 'var(--gold)' }
        })),
        links: data.graph.edges.map(e => ({
          source: e.source, target: e.target, relation: e.relation,
          lineStyle: { color: edgeColor[e.relation] || 'var(--muted)', width: 1 + e.weight, shadowBlur: 6, shadowColor: edgeColor[e.relation] }
        }))
      }]
    }
  }, [data])
  const graphRef = useEchart(graphOption)

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload: any = {
        datetime: new Date(form.datetime).toISOString(),
        timezone: form.timezone,
        gender: form.gender
      }
      if (form.useTrueSolarTime) {
        const lat = parseFloat(form.lat)
        const lon = parseFloat(form.lon)
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          payload.useTrueSolarTime = true
          payload.location = { lat, lon }
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

      <main className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="card p-4 lg:col-span-1">
          <h2 className="mb-3 text-sm text-gray-300">{t('input')}</h2>
          <form className="space-y-3" onSubmit={onSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <div>
              <label className="block text-xs muted mb-1">{t('datetime')}</label>
              <input className="w-full input" type="datetime-local" value={form.datetime}
                onChange={e=>setForm(prev=>({ ...prev, datetime: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs muted mb-1">{t('timezone')}</label>
              <input className="w-full input" placeholder="Asia/Shanghai" value={form.timezone}
                onChange={e=>setForm(prev=>({ ...prev, timezone: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <input id="trueSolar" type="checkbox" className="h-4 w-4" checked={form.useTrueSolarTime}
                onChange={e=>setForm(prev=>({ ...prev, useTrueSolarTime: e.target.checked }))} />
              <label htmlFor="trueSolar" className="text-xs muted">{t('trueSolar')}</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs muted mb-1">{t('latitude')}</label>
                <input className="w-full input" placeholder="31.23" value={form.lat}
                  onChange={e=>setForm(prev=>({ ...prev, lat: e.target.value }))} disabled={!form.useTrueSolarTime} />
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
                <span className="chip">木 {data.fiveElementPower.wood.toFixed(2)}</span>
                <span className="chip">火 {data.fiveElementPower.fire.toFixed(2)}</span>
                <span className="chip">土 {data.fiveElementPower.earth.toFixed(2)}</span>
                <span className="chip">金 {data.fiveElementPower.metal.toFixed(2)}</span>
                <span className="chip">水 {data.fiveElementPower.water.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="radar-box">
            <div ref={enhancedRadarRef} style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="panel-note-fixed text-xs muted">
            提示：鼠标悬停查看各项具体数值；“木/火/土/金/水”分别对应生发/炎上/稼穑/肃杀/润下。
          </div>
        </section>

        {data && (
        <section className="card p-4 lg:col-span-3">
          <h2 className="mb-3 text-sm muted">{t('bazi')}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
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
                <div className="pillar-han text-3xl tracking-widest tooltip">{x.p.heavenlyStem}{x.p.earthlyBranch}
                  <div className="tooltip-content text-left">
                    <div>纳音：{x.p.naYin || '-'}</div>
                    <div>藏干：{(x.p.hiddenStems||[]).join('、') || '-'}</div>
                  </div>
                </div>
              </div>
            )})}
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="flex gap-2">
              {data.luckCycles.daYun.map((d, i) => (
                <div key={i} className="min-w-[160px] p-3 rounded border border-[var(--border)] bg-[var(--card)]">
                  <div className="text-[10px] muted">{d.startYear}（{d.startAge}岁）</div>
                  <div className="gold text-xl tracking-widest">{d.pillar}</div>
                </div>
              ))}
            </div>
          </div>
          {data.advice && (
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              <div className="p-3 rounded border border-[var(--border)] bg-[var(--card)]">
                <div className="text-xs muted">日主</div>
                <div className="gold text-lg">{data.advice.dayMaster.stem}（{data.advice.dayMaster.element}）</div>
              </div>
              <div className="p-3 rounded border border-[var(--border)] bg-[var(--card)]">
                <div className="text-xs muted">强弱</div>
                <div className="text-sm tooltip">{data.advice.strength==='weak'?'偏弱':data.advice.strength==='strong'?'偏旺':'中和'}
                  <div className="tooltip-content">{data.advice.notes}</div>
                </div>
              </div>
              <div className="p-3 rounded border border-[var(--border)] bg-[var(--card)]">
                <div className="text-xs muted">喜用</div>
                <div className="text-sm">{data.advice.favorable.map(e=>ELEMENT_CN[e]||e).join('、')}</div>
              </div>
              <div className="p-3 rounded border border-[var(--border)] bg-[var(--card)]">
                <div className="text-xs muted">忌讳</div>
                <div className="text-sm">{data.advice.avoid.map(e=>ELEMENT_CN[e]||e).join('、')}</div>
              </div>
              {/* 移除独立评价卡，已移动到强弱卡的悬停词条 */}
            </div>
          )}

          {/* 命盘细则：纳音 / 藏干 / 十神 / 空亡 / 神煞（简） */}
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2 tooltip">纳音
                <div className="tooltip-content">{NOTE_NAYIN}</div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div><div className="text-[10px] muted">年</div><div>{data.year.naYin || '-'}</div></div>
                <div><div className="text-[10px] muted">月</div><div>{data.month.naYin || '-'}</div></div>
                <div><div className="text-[10px] muted">日</div><div>{data.day.naYin || '-'}</div></div>
                <div><div className="text-[10px] muted">时</div><div>{data.hour.naYin || '-'}</div></div>
              </div>
            </div>
            <div className="p-4 rounded bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2">藏干</div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div><div className="text-[10px] muted">年</div><div>{(data.year.hiddenStems||[]).join('、') || '-'}</div></div>
                <div><div className="text-[10px] muted">月</div><div>{(data.month.hiddenStems||[]).join('、') || '-'}</div></div>
                <div><div className="text-[10px] muted">日</div><div>{(data.day.hiddenStems||[]).join('、') || '-'}</div></div>
                <div><div className="text-[10px] muted">时</div><div>{(data.hour.hiddenStems||[]).join('、') || '-'}</div></div>
              </div>
            </div>
            <div className="p-4 rounded bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2 tooltip">十神
                <div className="tooltip-content">以日主为中心的十种关系：比劫、食伤、财、官杀、印，阴阳与生克决定具体称谓。</div>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center text-sm">
                <div>
                  <div className="text-[10px] muted">年</div>
                  <div>
                    {(data as any).tenGods?.year || '-'}
                    { (data as any).tenGodsStrength && (data as any).tenGods?.year && (
                      <span className={`ml-2 badge badge-${(data as any).tenGodsStrength[(data as any).tenGods.year] || 'medium'}`}>评分</span>
                    )}
                  </div>
                  <div className="text-[11px] muted mt-1">{(data as any).tenGodsDetail?.year?.map((d:any)=>`${d.stem}${d.relation}`).join('、')||''}</div>
                </div>
                <div>
                  <div className="text-[10px] muted">月</div>
                  <div>
                    {(data as any).tenGods?.month || '-'}
                    { (data as any).tenGodsStrength && (data as any).tenGods?.month && (
                      <span className={`ml-2 badge badge-${(data as any).tenGodsStrength[(data as any).tenGods.month] || 'medium'}`}>评分</span>
                    )}
                  </div>
                  <div className="text-[11px] muted mt-1">{(data as any).tenGodsDetail?.month?.map((d:any)=>`${d.stem}${d.relation}`).join('、')||''}</div>
                </div>
                <div>
                  <div className="text-[10px] muted">日</div>
                  <div>日主</div>
                  <div className="text-[11px] muted mt-1">{(data as any).tenGodsDetail?.day?.map((d:any)=>`${d.stem}${d.relation}`).join('、')||''}</div>
                </div>
                <div>
                  <div className="text-[10px] muted">时</div>
                  <div>
                    {(data as any).tenGods?.hour || '-'}
                    { (data as any).tenGodsStrength && (data as any).tenGods?.hour && (
                      <span className={`ml-2 badge badge-${(data as any).tenGodsStrength[(data as any).tenGods.hour] || 'medium'}`}>评分</span>
                    )}
                  </div>
                  <div className="text-[11px] muted mt-1">{(data as any).tenGodsDetail?.hour?.map((d:any)=>`${d.stem}${d.relation}`).join('、')||''}</div>
                </div>
              </div>
            </div>
            <div className="p-4 rounded bg-[var(--card)] border border-[var(--border)]">
              <div className="text-xs muted mb-2 tooltip">空亡
                <div className="tooltip-content">{NOTE_XUNKONG}</div>
              </div>
              <div className="text-sm">
                {(data as any).emptyBranches?.length>0 ? (data as any).emptyBranches.join('、') : '—'}
                <span className="text-[11px] muted ml-2">（旬空）</span>
              </div>
            </div>
            {(() => {
              const pillars = [data.year, data.month, data.day, data.hour].map(p=>({ branch: p.earthlyBranch }))
              // 组合前端计算与服务端返回（去重合并）
              const localStars = computeShenShaPositions(pillars, data.day.earthlyBranch)
              const map = new Map<string, Set<string>>()
              const add = (name:string, hits:string[]) => {
                if (!map.has(name)) map.set(name, new Set())
                const s = map.get(name)!
                hits.forEach(h => s.add(h))
              }
              localStars.forEach(s => add(s.name, s.hits))
              ;(data.stars||[]).forEach(s => add(s.name, s.hits))
              const shensha = Array.from(map.entries()).map(([name, set]) => ({ name, hits: Array.from(set), group: (data.stars||[]).find(x=>x.name===name)?.group || (['天乙贵人','文昌'].includes(name)?'贵人':['羊刃'].includes(name)?'煞曜':'吉曜') }))
              return (
                <div className="p-4 rounded bg-[var(--card)] border border-[var(--border)] md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs muted mb-2">神煞</div>
                  </div>
                  {['贵人','吉曜','煞曜'].map(group=> (
                    <div key={group} className="mb-2">
                      <div className="text-[11px] muted mb-1">{group}</div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        {shensha.filter(s=>s.group===group).map((s,i)=> (
                          <span key={i} className="shield tooltip"><span className="dot"></span>{s.name}<span className="muted">{s.hits.join('、')}</span>
                            <div className="tooltip-content">{STAR_DESC[s.name]||s.name}</div>
                          </span>
                        ))}
                        {shensha.filter(s=>s.group===group).length===0 && <span className="text-[11px] muted">—</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
            {data.graph && (
              <div className="p-4 rounded bg-[var(--card)] border border-[var(--border)] md:col-span-2">
                <div className="text-xs muted mb-2">干系图</div>
                <div ref={graphRef as any} style={{ width: '100%', height: 260 }} />
                <div className="text-[11px] muted mt-2">说明：中心为日主关系放射图；边颜色表示关系（绿=生、红=克、灰=同），线条弯曲强调能量流向。</div>
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


