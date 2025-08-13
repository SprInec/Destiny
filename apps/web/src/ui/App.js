import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import axios from 'axios';
import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
const LS_KEY = 'destiny_profiles';
const ELEMENT_CN = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
const STAR_DESC = {
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
};
const TEN_GOD_DESC = {
    '比肩': '同我同气，助身扶身，旺则争比克财',
    '劫财': '同性同气，助身夺财，宜制衡',
    '食神': '我泄生他，温和之气，旺则制杀生财',
    '伤官': '我泄过度，聪慧外放，旺则伤官见官为忌',
    '正财': '我克之财，勤俭务实，忌被劫夺',
    '偏财': '横财机遇，宜收敛节制',
    '正官': '克我而正，规矩秩序，旺则压身',
    '七杀': '克我而偏，魄力权柄，宜食神制杀',
    '正印': '生我而正，涵养支持，旺则惰性',
    '偏印': '生我而偏，机敏灵动，忌过旺化为枭神'
};
const NOTE_NAYIN = '纳音：六十甲子配五行之名，用以辅佐判断气质与声气。';
const NOTE_XUNKONG = '旬空：该旬中欠缺之支，遇空则象征事物不固或延期。';
function groupBySanHe(branch) {
    if (['申', '子', '辰'].includes(branch))
        return '申子辰';
    if (['寅', '午', '戌'].includes(branch))
        return '寅午戌';
    if (['巳', '酉', '丑'].includes(branch))
        return '巳酉丑';
    if (['亥', '卯', '未'].includes(branch))
        return '亥卯未';
    return null;
}
function starPos(group, star) {
    if (!group)
        return null;
    const map = {
        '申子辰': { '桃花': '酉', '驿马': '寅', '华盖': '辰' },
        '寅午戌': { '桃花': '卯', '驿马': '申', '华盖': '戌' },
        '巳酉丑': { '桃花': '午', '驿马': '亥', '华盖': '丑' },
        '亥卯未': { '桃花': '子', '驿马': '巳', '华盖': '未' }
    };
    return map[group]?.[star] ?? null;
}
function computeShenShaPositions(pillars, dayBranch) {
    const group = groupBySanHe(dayBranch);
    const stars = ['桃花', '驿马', '华盖'];
    const results = [];
    const labels = ['年', '月', '日', '时'];
    stars.forEach(s => {
        const pos = starPos(group, s);
        if (!pos)
            return;
        const hits = pillars.map((p, i) => ({ p, i })).filter(x => x.p.branch === pos).map(x => labels[x.i]);
        if (hits.length > 0)
            results.push({ name: s, hits });
    });
    return results;
}
function useEchart(option) {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current)
            return;
        const chart = echarts.init(ref.current);
        chart.setOption(option);
        const onResize = () => chart.resize();
        window.addEventListener('resize', onResize);
        // Observe container size changes to keep chart centered when sibling cards change height
        let ro = null;
        try {
            const R = window.ResizeObserver;
            if (R && ref.current) {
                ro = new R(() => { chart.resize(); });
                ro.observe(ref.current);
            }
        }
        catch { }
        return () => { if (ro && ro.disconnect)
            ro.disconnect(); window.removeEventListener('resize', onResize); chart.dispose(); };
    }, [JSON.stringify(option)]);
    return ref;
}
export function App() {
    const [form, setForm] = useState({ datetime: new Date().toISOString().slice(0, 16), timezone: 'Asia/Shanghai', gender: 'male', useTrueSolarTime: false, lat: '', lon: '' });
    const [data, setData] = useState(null);
    const [lang, setLang] = useState('zh');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [profiles, setProfiles] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
        }
        catch {
            return [];
        }
    });
    const [isDark, setIsDark] = useState(true);
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
    }), []);
    const t = (k) => dict[lang][k] || k;
    useEffect(() => {
        const root = document.documentElement;
        if (isDark)
            root.classList.add('dark');
        else
            root.classList.remove('dark');
    }, [isDark]);
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
                    ]] : [[0, 0, 0, 0, 0]]
            }]
    }), [data]);
    const radarRef = useEchart(radarOption);
    // enhanced radar with rich labels and split areas
    const enhancedRadar = useMemo(() => {
        const values = data ? [
            data.fiveElementPower.wood,
            data.fiveElementPower.fire,
            data.fiveElementPower.earth,
            data.fiveElementPower.metal,
            data.fiveElementPower.water
        ] : [0, 0, 0, 0, 0];
        const isDarkTheme = document.documentElement.classList.contains('dark');
        const gridColor = isDarkTheme ? 'rgba(148,163,184,0.35)' : 'rgba(71,85,105,0.35)';
        const textColor = isDarkTheme ? '#e5e7eb' : '#0f172a';
        const areaColor = isDarkTheme ? 'rgba(212,175,55,0.25)' : 'rgba(184,134,11,0.25)';
        const lineColor = isDarkTheme ? 'rgba(212,175,55,0.95)' : 'rgba(184,134,11,0.95)';
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: (p) => {
                    const v = values;
                    const names = ['木', '火', '土', '金', '水'];
                    return names.map((n, i) => `${n}：<b>${v[i].toFixed(2)}</b>`).join('<br/>');
                }
            },
            radar: {
                center: ['50%', '50%'],
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
                splitArea: { areaStyle: { color: ['transparent', isDarkTheme ? 'rgba(212,175,55,0.06)' : 'rgba(184,134,11,0.06)'] } }
            },
            series: [{
                    type: 'radar',
                    symbol: 'circle',
                    symbolSize: 6,
                    lineStyle: { color: lineColor },
                    itemStyle: { color: lineColor, borderColor: isDarkTheme ? '#000' : '#fff', borderWidth: 1 },
                    areaStyle: { color: areaColor },
                    data: [values]
                }]
        };
    }, [data]);
    const enhancedRadarRef = useEchart(enhancedRadar);
    // graph visualization (stems relation)
    const graphOption = useMemo(() => {
        if (!data?.graph)
            return { series: [] };
        const palette = { wood: '#22c55e', fire: '#ef4444', earth: '#eab308', metal: '#f59e0b', water: '#3b82f6' };
        const edgeColor = { '生': '#10b981', '克': '#ef4444', '同': '#64748b' };
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: (p) => {
                    if (p.dataType === 'node')
                        return `${p.data.label} · ${p.data.element}`;
                    if (p.dataType === 'edge')
                        return `${p.data.source} ${p.data.relation} ${p.data.target}`;
                    return '';
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
                    label: { show: true, color: '#0b0f14', fontWeight: 700, backgroundColor: '#fff', padding: [4, 6], borderRadius: 6 },
                    edgeSymbol: ['circle', 'arrow'],
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
        };
    }, [data]);
    const graphRef = useEchart(graphOption);
    const [timeline, setTimeline] = useState(null);
    function getApiBase() {
        const raw = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const noTrail = String(raw).replace(/\/$/, '');
        return noTrail.replace(/\/api$/i, '');
    }
    useEffect(() => {
        const base = getApiBase();
        const y = new Date().getFullYear();
        axios.get(base + '/api/timeline/' + y).then(r => setTimeline(r.data.months)).catch(() => { });
    }, []);
    async function onSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const payload = {
                datetime: new Date(form.datetime).toISOString(),
                timezone: form.timezone,
                gender: form.gender
            };
            if (form.useTrueSolarTime) {
                const lat = parseFloat(form.lat);
                const lon = parseFloat(form.lon);
                if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
                    payload.useTrueSolarTime = true;
                    payload.location = { lat, lon };
                }
            }
            const base = getApiBase();
            const resp = await axios.post(base + '/api/bazi', payload);
            setData(resp.data);
            // auto save profile
            const p = { id: `${Date.now()}`, datetime: form.datetime, timezone: form.timezone, gender: form.gender, createdAt: Date.now() };
            const next = [p, ...profiles].slice(0, 20);
            setProfiles(next);
            localStorage.setItem(LS_KEY, JSON.stringify(next));
        }
        catch (err) {
            const msg = err?.response?.data?.error?.message || err?.response?.data?.error || err?.message || '请求失败';
            setError(String(msg));
            console.error('Bazi request error:', err);
        }
        finally {
            setLoading(false);
        }
    }
    async function exportPDF() {
        const container = document.body;
        const canvas = await html2canvas(container, { backgroundColor: '#0b0f14', scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = (canvas.height * pageWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
        pdf.save('destiny-bazi.pdf');
    }
    function loadProfile(p) {
        setForm(prev => ({
            ...prev,
            datetime: p.datetime,
            timezone: p.timezone,
            gender: p.gender
        }));
        setData(null);
    }
    function clearHistory() {
        setProfiles([]);
        localStorage.removeItem(LS_KEY);
    }
    return (_jsxs("div", { className: "min-h-screen", children: [_jsxs("header", { className: "px-6 py-4 border-b border-gray-800 flex items-center justify-between", children: [_jsxs("h1", { className: "text-xl tracking-widest gold", children: ["DESTINY \u00B7 ", t('title')] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: exportPDF, className: "btn text-xs", children: t('export') }), _jsx("button", { onClick: () => setIsDark(v => !v), className: "btn text-xs", title: t('theme'), children: isDark ? t('dark') : t('light') }), _jsxs("select", { value: lang, onChange: e => setLang(e.target.value), className: "select text-xs", children: [_jsx("option", { value: "zh", children: "\u4E2D\u6587" }), _jsx("option", { value: "en", children: "EN" })] })] })] }), _jsxs("main", { className: "p-6 grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("section", { className: "card p-4 lg:col-span-1", children: [_jsx("h2", { className: "mb-3 text-sm text-gray-300", children: t('input') }), _jsxs("form", { className: "space-y-3", onSubmit: onSubmit, children: [error && _jsx("div", { className: "alert alert-error", children: error }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('datetime') }), _jsx("input", { className: "w-full input", type: "datetime-local", value: form.datetime, onChange: e => setForm(prev => ({ ...prev, datetime: e.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('timezone') }), _jsx("input", { className: "w-full input", placeholder: "Asia/Shanghai", value: form.timezone, onChange: e => setForm(prev => ({ ...prev, timezone: e.target.value })) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { id: "trueSolar", type: "checkbox", className: "h-4 w-4", checked: form.useTrueSolarTime, onChange: e => setForm(prev => ({ ...prev, useTrueSolarTime: e.target.checked })) }), _jsx("label", { htmlFor: "trueSolar", className: "text-xs muted", children: t('trueSolar') })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('latitude') }), _jsx("input", { className: "w-full input", placeholder: "31.23", value: form.lat, onChange: e => setForm(prev => ({ ...prev, lat: e.target.value })), disabled: !form.useTrueSolarTime })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('longitude') }), _jsx("input", { className: "w-full input", placeholder: "121.47", value: form.lon, onChange: e => setForm(prev => ({ ...prev, lon: e.target.value })), disabled: !form.useTrueSolarTime })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('gender') }), _jsxs("select", { className: "w-full select", value: form.gender, onChange: e => setForm(prev => ({ ...prev, gender: e.target.value })), children: [_jsx("option", { value: "male", children: t('male') }), _jsx("option", { value: "female", children: t('female') })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { disabled: loading, className: "flex-1 btn btn-primary mt-2", children: loading ? t('calculating') : t('submit') }), _jsx("button", { type: "button", onClick: () => {
                                                    const p = { id: `${Date.now()}`, datetime: form.datetime, timezone: form.timezone, gender: form.gender, createdAt: Date.now() };
                                                    const next = [p, ...profiles].slice(0, 20);
                                                    setProfiles(next);
                                                    localStorage.setItem(LS_KEY, JSON.stringify(next));
                                                }, className: "btn text-xs mt-2", children: t('save') })] })] }), profiles.length > 0 && (_jsxs("div", { className: "mt-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "text-xs text-gray-400", children: t('history') }), _jsx("button", { onClick: clearHistory, className: "text-[10px] text-gray-400", children: "\u6E05\u7A7A" })] }), _jsx("div", { className: "space-y-2 max-h-60 overflow-y-auto pr-1", children: profiles.map(p => (_jsxs("div", { className: "list-item", children: [_jsx("div", { className: "text-xs muted", children: p.datetime.replace('T', ' ') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "chip", children: p.gender === 'male' ? '男' : '女' }), _jsx("button", { onClick: () => loadProfile(p), className: "btn text-[10px] px-2 py-0.5", children: "\u52A0\u8F7D" })] })] }, p.id))) })] }))] }), _jsxs("section", { className: "card card-stretch p-4 lg:col-span-2", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h2", { className: "text-sm muted", children: t('five') }), data && (_jsxs("div", { className: "text-[11px] muted flex gap-2", children: [_jsxs("span", { className: "chip", children: ["\u6728 ", data.fiveElementPower.wood.toFixed(2)] }), _jsxs("span", { className: "chip", children: ["\u706B ", data.fiveElementPower.fire.toFixed(2)] }), _jsxs("span", { className: "chip", children: ["\u571F ", data.fiveElementPower.earth.toFixed(2)] }), _jsxs("span", { className: "chip", children: ["\u91D1 ", data.fiveElementPower.metal.toFixed(2)] }), _jsxs("span", { className: "chip", children: ["\u6C34 ", data.fiveElementPower.water.toFixed(2)] })] }))] }), _jsx("div", { className: "radar-box", children: _jsx("div", { ref: enhancedRadarRef, style: { width: '100%', height: '100%' } }) }), _jsx("div", { className: "panel-note-fixed text-xs muted", children: "\u63D0\u793A\uFF1A\u9F20\u6807\u60AC\u505C\u67E5\u770B\u5404\u9879\u5177\u4F53\u6570\u503C\uFF1B\u201C\u6728/\u706B/\u571F/\u91D1/\u6C34\u201D\u5206\u522B\u5BF9\u5E94\u751F\u53D1/\u708E\u4E0A/\u7A3C\u7A51/\u8083\u6740/\u6DA6\u4E0B\u3002" })] }), data && (_jsxs("section", { className: "card p-4 lg:col-span-3", children: [_jsx("h2", { className: "mb-3 text-sm muted", children: t('bazi') }), _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-3 text-center", children: [
                                    { label: '年柱', p: data.year },
                                    { label: '月柱', p: data.month },
                                    { label: '日柱', p: data.day },
                                    { label: '时柱', p: data.hour }
                                ].map((x, i) => {
                                    const elMap = { '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire', '戊': 'earth', '己': 'earth', '庚': 'metal', '辛': 'metal', '壬': 'water', '癸': 'water' };
                                    const el = elMap[x.p.heavenlyStem] || 'earth';
                                    return (_jsxs("div", { className: "p-5 rounded-card pillar-card pillar", "data-el": el, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("div", { className: "pillar-tag", children: x.label }), _jsx("span", { className: "pillar-badge", "data-el": el, children: ELEMENT_CN[el] || el })] }), _jsxs("div", { className: "pillar-han text-3xl tracking-widest tooltip", children: [x.p.heavenlyStem, x.p.earthlyBranch, _jsxs("div", { className: "tooltip-content text-left", children: [_jsxs("div", { children: ["\u7EB3\u97F3\uFF1A", x.p.naYin || '-'] }), _jsxs("div", { children: ["\u85CF\u5E72\uFF1A", (x.p.hiddenStems || []).join('、') || '-'] })] })] })] }, i));
                                }) }), _jsx("div", { className: "mt-4 overflow-x-auto", children: _jsx("div", { className: "flex gap-2", children: data.luckCycles.daYun.map((d, i) => (_jsxs("div", { className: "min-w-[160px] p-3 rounded border border-[var(--border)] bg-[var(--card)]", children: [_jsxs("div", { className: "text-[10px] muted", children: [d.startYear, "\uFF08", d.startAge, "\u5C81\uFF09"] }), _jsx("div", { className: "gold text-xl tracking-widest", children: d.pillar })] }, i))) }) }), data.advice && (_jsxs("div", { className: "mt-6 grid md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "p-3 rounded border border-[var(--border)] bg-[var(--card)]", children: [_jsx("div", { className: "text-xs muted", children: "\u65E5\u4E3B" }), _jsxs("div", { className: "gold text-lg", children: [data.advice.dayMaster.stem, "\uFF08", data.advice.dayMaster.element, "\uFF09"] })] }), _jsxs("div", { className: "p-3 rounded border border-[var(--border)] bg-[var(--card)]", children: [_jsx("div", { className: "text-xs muted", children: "\u5F3A\u5F31" }), _jsxs("div", { className: "text-sm tooltip", children: [data.advice.strength === 'weak' ? '偏弱' : data.advice.strength === 'strong' ? '偏旺' : '中和', _jsx("div", { className: "tooltip-content", children: data.advice.notes })] })] }), _jsxs("div", { className: "p-3 rounded border border-[var(--border)] bg-[var(--card)]", children: [_jsx("div", { className: "text-xs muted", children: "\u559C\u7528" }), _jsx("div", { className: "text-sm", children: data.advice.favorable.map(e => ELEMENT_CN[e] || e).join('、') })] }), _jsxs("div", { className: "p-3 rounded border border-[var(--border)] bg-[var(--card)]", children: [_jsx("div", { className: "text-xs muted", children: "\u5FCC\u8BB3" }), _jsx("div", { className: "text-sm", children: data.advice.avoid.map(e => ELEMENT_CN[e] || e).join('、') })] })] })), _jsxs("div", { className: "mt-6 grid md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "p-4 rounded bg-[var(--card)] border border-[var(--border)]", children: [_jsxs("div", { className: "text-xs muted mb-2 tooltip", children: ["\u7EB3\u97F3", _jsx("div", { className: "tooltip-content", children: NOTE_NAYIN })] }), _jsxs("div", { className: "grid grid-cols-4 gap-2 text-center text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u5E74" }), _jsx("div", { children: data.year.naYin || '-' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u6708" }), _jsx("div", { children: data.month.naYin || '-' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65E5" }), _jsx("div", { children: data.day.naYin || '-' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65F6" }), _jsx("div", { children: data.hour.naYin || '-' })] })] })] }), _jsxs("div", { className: "p-4 rounded bg-[var(--card)] border border-[var(--border)]", children: [_jsx("div", { className: "text-xs muted mb-2", children: "\u85CF\u5E72" }), _jsxs("div", { className: "grid grid-cols-4 gap-2 text-center text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u5E74" }), _jsx("div", { children: (data.year.hiddenStems || []).join('、') || '-' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u6708" }), _jsx("div", { children: (data.month.hiddenStems || []).join('、') || '-' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65E5" }), _jsx("div", { children: (data.day.hiddenStems || []).join('、') || '-' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65F6" }), _jsx("div", { children: (data.hour.hiddenStems || []).join('、') || '-' })] })] })] }), _jsxs("div", { className: "p-4 rounded bg-[var(--card)] border border-[var(--border)]", children: [_jsxs("div", { className: "text-xs muted mb-2 tooltip", children: ["\u5341\u795E", _jsx("div", { className: "tooltip-content", children: "\u4EE5\u65E5\u4E3B\u4E3A\u4E2D\u5FC3\u7684\u5341\u79CD\u5173\u7CFB\uFF1A\u6BD4\u52AB\u3001\u98DF\u4F24\u3001\u8D22\u3001\u5B98\u6740\u3001\u5370\uFF0C\u9634\u9633\u4E0E\u751F\u514B\u51B3\u5B9A\u5177\u4F53\u79F0\u8C13\u3002" })] }), _jsxs("div", { className: "grid grid-cols-4 gap-3 text-center text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u5E74" }), _jsxs("div", { children: [data.tenGods?.year || '-', data.tenGodsStrength && data.tenGods?.year && (_jsx("span", { className: `ml-2 badge badge-${data.tenGodsStrength[data.tenGods.year] || 'medium'}`, children: "\u8BC4\u5206" }))] }), _jsx("div", { className: "text-[11px] muted mt-1", children: data.tenGodsDetail?.year?.map((d) => `${d.stem}${d.relation}`).join('、') || '' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u6708" }), _jsxs("div", { children: [data.tenGods?.month || '-', data.tenGodsStrength && data.tenGods?.month && (_jsx("span", { className: `ml-2 badge badge-${data.tenGodsStrength[data.tenGods.month] || 'medium'}`, children: "\u8BC4\u5206" }))] }), _jsx("div", { className: "text-[11px] muted mt-1", children: data.tenGodsDetail?.month?.map((d) => `${d.stem}${d.relation}`).join('、') || '' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65E5" }), _jsx("div", { children: "\u65E5\u4E3B" }), _jsx("div", { className: "text-[11px] muted mt-1", children: data.tenGodsDetail?.day?.map((d) => `${d.stem}${d.relation}`).join('、') || '' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65F6" }), _jsxs("div", { children: [data.tenGods?.hour || '-', data.tenGodsStrength && data.tenGods?.hour && (_jsx("span", { className: `ml-2 badge badge-${data.tenGodsStrength[data.tenGods.hour] || 'medium'}`, children: "\u8BC4\u5206" }))] }), _jsx("div", { className: "text-[11px] muted mt-1", children: data.tenGodsDetail?.hour?.map((d) => `${d.stem}${d.relation}`).join('、') || '' })] })] })] }), _jsxs("div", { className: "p-4 rounded bg-[var(--card)] border border-[var(--border)]", children: [_jsxs("div", { className: "text-xs muted mb-2 tooltip", children: ["\u7A7A\u4EA1", _jsx("div", { className: "tooltip-content", children: NOTE_XUNKONG })] }), _jsxs("div", { className: "text-sm", children: [data.emptyBranches?.length > 0 ? data.emptyBranches.join('、') : '—', _jsx("span", { className: "text-[11px] muted ml-2", children: "\uFF08\u65EC\u7A7A\uFF09" })] })] }), (() => {
                                        const pillars = [data.year, data.month, data.day, data.hour].map(p => ({ branch: p.earthlyBranch }));
                                        // 组合前端计算与服务端返回（去重合并）
                                        const localStars = computeShenShaPositions(pillars, data.day.earthlyBranch);
                                        const map = new Map();
                                        const add = (name, hits) => {
                                            if (!map.has(name))
                                                map.set(name, new Set());
                                            const s = map.get(name);
                                            hits.forEach(h => s.add(h));
                                        };
                                        localStars.forEach(s => add(s.name, s.hits));
                                        (data.stars || []).forEach(s => add(s.name, s.hits));
                                        const shensha = Array.from(map.entries()).map(([name, set]) => ({ name, hits: Array.from(set), group: (data.stars || []).find(x => x.name === name)?.group || (['天乙贵人', '文昌'].includes(name) ? '贵人' : ['羊刃'].includes(name) ? '煞曜' : '吉曜') }));
                                        return (_jsxs("div", { className: "p-4 rounded bg-[var(--card)] border border-[var(--border)] md:col-span-2", children: [_jsx("div", { className: "flex items-center justify-between", children: _jsx("div", { className: "text-xs muted mb-2", children: "\u795E\u715E" }) }), ['贵人', '吉曜', '煞曜'].map(group => (_jsxs("div", { className: "mb-2", children: [_jsx("div", { className: "text-[11px] muted mb-1", children: group }), _jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-3 gap-3", children: [shensha.filter(s => s.group === group).map((s, i) => (_jsxs("span", { className: "shield tooltip", children: [_jsx("span", { className: "dot" }), s.name, _jsx("span", { className: "muted", children: s.hits.join('、') }), _jsx("div", { className: "tooltip-content", children: STAR_DESC[s.name] || s.name })] }, i))), shensha.filter(s => s.group === group).length === 0 && _jsx("span", { className: "text-[11px] muted", children: "\u2014" })] })] }, group)))] }));
                                    })(), data.graph && (_jsxs("div", { className: "p-4 rounded bg-[var(--card)] border border-[var(--border)] md:col-span-2", children: [_jsx("div", { className: "text-xs muted mb-2", children: "\u5E72\u7CFB\u56FE" }), _jsx("div", { ref: graphRef, style: { width: '100%', height: 260 } }), _jsx("div", { className: "text-[11px] muted mt-2", children: "\u8BF4\u660E\uFF1A\u4E2D\u5FC3\u4E3A\u65E5\u4E3B\u5173\u7CFB\u653E\u5C04\u56FE\uFF1B\u8FB9\u989C\u8272\u8868\u793A\u5173\u7CFB\uFF08\u7EFF=\u751F\u3001\u7EA2=\u514B\u3001\u7070=\u540C\uFF09\uFF0C\u7EBF\u6761\u5F2F\u66F2\u5F3A\u8C03\u80FD\u91CF\u6D41\u5411\u3002" })] }))] })] })), timeline && (_jsxs("section", { className: "card p-4 lg:col-span-3", children: [_jsx("h2", { className: "mb-3 text-sm text-gray-300", children: t('chart_months') }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-6 gap-3 text-center", children: timeline.map((m, i) => (_jsxs("div", { className: "p-3 rounded border border-[var(--border)] bg-[var(--card)]", children: [_jsxs("div", { className: "text-xs muted", children: [m.month, "\u6708"] }), _jsx("div", { className: "gold text-lg tracking-widest", children: m.pillar })] }, i))) })] }))] })] }));
}
//# sourceMappingURL=App.js.map