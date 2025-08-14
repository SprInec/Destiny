import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import axios from 'axios';
import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
const LS_KEY = 'destiny_profiles';
const ELEMENT_CN = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
const ELEMENT_COLOR = { wood: '#22c55e', fire: '#ef4444', earth: '#eab308', metal: '#f59e0b', water: '#3b82f6' };
const BRANCH_ELEMENT = {
    '寅': 'wood', '卯': 'wood',
    '巳': 'fire', '午': 'fire',
    '辰': 'earth', '丑': 'earth', '未': 'earth', '戌': 'earth',
    '申': 'metal', '酉': 'metal',
    '亥': 'water', '子': 'water'
};
// ChangSheng stages for 星运/自坐
const STAGE_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
const BRANCH_SEQ = ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'];
const START_BRANCH_BY_STEM = { '甲': '亥', '丙': '寅', '戊': '寅', '庚': '巳', '壬': '申', '乙': '午', '丁': '酉', '己': '酉', '辛': '子', '癸': '卯' };
function changShengOf(dayStem, targetBranch) {
    const start = START_BRANCH_BY_STEM[dayStem] || '亥';
    const isYang = '甲丙戊庚壬'.includes(dayStem);
    const startIdx = BRANCH_SEQ.indexOf(start);
    const targetIdx = BRANCH_SEQ.indexOf(targetBranch);
    if (startIdx < 0 || targetIdx < 0)
        return '';
    let diff = (targetIdx - startIdx + 12) % 12;
    if (!isYang)
        diff = (startIdx - targetIdx + 12) % 12;
    return STAGE_NAMES[diff];
}
const NOTE_CHANGSHENG = '十二长生：长生→沐浴→冠带→临官→帝旺→衰→病→死→墓→绝→胎→养，阴干逆行、阳干顺行，起点依各天干所属。';
const CHANGSHENG_DESC = {
    '长生': '如婴儿初生，生机勃勃，开始发展，宜培养扶持',
    '沐浴': '如幼儿洗浴，纯真脆弱，易受影响，需小心呵护',
    '冠带': '如青年加冠，开始成熟，渐有作为，但仍需历练',
    '临官': '如壮年临职，能力渐显，可担重任，正值上升期',
    '帝旺': '如帝王鼎盛，力量最强，功成名就，但盛极必衰',
    '衰': '如中年体衰，力量减弱，需要调养，宜守不宜攻',
    '病': '如身患疾病，阻滞困顿，多有不顺，需要治疗调理',
    '死': '如生命垂危，极度衰弱，万事不利，宜静待转机',
    '墓': '如入墓库中，收藏蛰伏，暂时隐匿，等待时机',
    '绝': '如断绝生机，到达谷底，但物极必反，孕育新生',
    '胎': '如受孕成胎，新的开始，潜力初现，需要孕育',
    '养': '如婴儿哺养，逐渐成长，积蓄力量，准备长生'
};
const STAR_DESC = {
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
const XUNKONG_DESC = {
    '子': '子水空亡，情感波动，水性不定',
    '丑': '丑土空亡，财库不稳，积蓄有变',
    '寅': '寅木空亡，生发受阻，计划多变',
    '卯': '卯木空亡，才华难显，文书有失',
    '辰': '辰土空亡，库藏不实，变动频繁',
    '巳': '巳火空亡，智慧受限，文昌不利',
    '午': '午火空亡，名声有损，心神不宁',
    '未': '未土空亡，福德有缺，人际波折',
    '申': '申金空亡，权威不稳，变动多端',
    '酉': '酉金空亡，口舌是非，金钱有失',
    '戌': '戌土空亡，根基不稳，变迁频繁',
    '亥': '亥水空亡，智慧蒙蔽，学业有阻'
};
const NAYIN_DESC = {
    '海中金': '海底之金，藏锋蓄势，遇火土则成器。',
    '炉中火': '炉冶之火，需薪助旺，得木为佳。',
    '大林木': '林木茂盛，喜金水修饰滋养。',
    '路旁土': '道路之土，宜修整培护，得木疏土。',
    '剑锋金': '刃金之性，喜火锻炼成器。',
    '山头火': '山巅之火，势高烈，得木为薪。',
    '涧下水': '溪涧流泉，喜土成渠，遇金更清。',
    '城头土': '城垣之土，厚重稳固，忌木穿克。',
    '白蜡金': '饰器之金，需火炼形，遇水恐损光。',
    '杨柳木': '柔木之象，得水滋润，忌金砍伐。',
    '井泉水': '井泉之水，贵清澄，得金导流。',
    '屋上土': '覆屋之土，能蔽风雨，喜木为梁。',
    '霹雳火': '雷火激烈，遇金为电，畏水遏势。',
    '松柏木': '常青之木，耐寒耐霜，得水更荣。',
    '长流水': '江河之水，源远流长，得土为堤。',
    '沙中金': '沙里藏金，需淘洗炼成器。',
    '山下火': '山麓之火，势渐旺，喜木添薪。',
    '平地木': '原野之木，得水土滋养成林。',
    '壁上土': '墙垣之土，需木为架，畏水冲刷。',
    '金箔金': '饰面之金，喜火炼形，忌土尘蔽光。',
    '覆灯火': '灯烛之火，需油薪，畏水扑灭。',
    '天河水': '银河之水，清凉灵动，喜金为器。',
    '大驿土': '大道之土，承载往来，畏木穿克。',
    '钗钏金': '首饰之金，喜火锻造成形。',
    '桑柘木': '桑柘之木，得水育桑，宜修剪。',
    '大溪水': '大溪之水，急流奔涌，喜土为堤。',
    '沙中土': '细沙之土，需水固结成型。',
    '天上火': '天曜之火，光明昭彰，畏水压制。',
    '石榴木': '果木之象，得水肥而丰实。',
    '大海水': '汪洋之水，包容万物，喜金导流。'
};
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
// Lightweight edge-aware tooltip directive (attribute-based)
function useEdgeAwareTooltips() {
    useEffect(() => {
        const handler = (e) => {
            const t = e.target;
            const host = t?.closest?.('.tooltip');
            if (!host)
                return;
            const rect = host.getBoundingClientRect();
            host.removeAttribute('data-edge');
            const margin = 16;
            if (rect.left < margin)
                host.setAttribute('data-edge', 'left');
            else if (window.innerWidth - rect.right < margin)
                host.setAttribute('data-edge', 'right');
            else if (rect.top < 80)
                host.setAttribute('data-edge', 'top');
        };
        document.addEventListener('mousemove', handler, { passive: true });
        return () => document.removeEventListener('mousemove', handler);
    }, []);
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
    const [graphTab, setGraphTab] = useState('stem');
    useEdgeAwareTooltips();
    const dict = useMemo(() => ({
        zh: {
            title: '八字命理', input: '输入生辰', datetime: '日期时间', timezone: '时区', gender: '性别', male: '男', female: '女',
            submit: '排盘', calculating: '计算中…', five: '五行能量', chart_months: '流月', bazi: '命盘',
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
    // graph visualization (stems relation) - 简约玄美风格
    const graphOption = useMemo(() => {
        if (!data?.graph)
            return { series: [] };
        const palette = {
            wood: '#6b7280', fire: '#9ca3af', earth: '#d4af37', metal: '#94a3b8', water: '#64748b'
        };
        const edgeColor = {
            '生': 'rgba(16,185,129,0.9)', '克': 'rgba(239,68,68,0.9)', '同': 'rgba(148,163,184,0.75)'
        };
        const relationDesc = {
            '生': '相生助力，和谐互补',
            '克': '相克制约，需要平衡',
            '同': '同气相求，力量叠加'
        };
        const isDark = document.documentElement.classList.contains('dark');
        const nodes = data.graph.nodes;
        const edges = data.graph.edges;
        const hasIsolated = nodes.some(n => !edges.some(e => e.source === n.id || e.target === n.id));
        const useCircular = hasIsolated;
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
                formatter: (p) => {
                    if (p.dataType === 'node') {
                        const elementCN = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
                        return `<div style="font-weight:500;color:var(--gold);">${p.data.id}柱·${p.data.label}</div><div style="margin-top:4px;font-size:11px;opacity:0.8;">${elementCN[p.data.element] || p.data.element}行之气</div>`;
                    }
                    if (p.dataType === 'edge') {
                        return `<div style="font-weight:500;">${p.data.source} ${p.data.relation} ${p.data.target}</div><div style="margin-top:4px;font-size:11px;opacity:0.8;">${relationDesc[p.data.relation] || ''}</div>`;
                    }
                    return '';
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
                        formatter: (params) => `${params.data.id}\n${params.data.label}`
                    },
                    edgeSymbol: ['none', 'arrow'],
                    edgeSymbolSize: [0, 9],
                    edgeLabel: {
                        show: true,
                        color: isDark ? 'rgba(156,163,175,0.8)' : 'rgba(107,114,128,0.8)',
                        fontSize: 10,
                        fontWeight: 400,
                        formatter: (params) => params.data.relation
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
        };
    }, [data]);
    const graphRef = useEchart(graphOption);
    // 地支关系图 - 简约玄美风格
    const branchGraphOption = useMemo(() => {
        if (!data?.branchGraph)
            return { series: [] };
        const palette = {
            wood: '#6b7280', fire: '#9ca3af', earth: '#d4af37', metal: '#94a3b8', water: '#64748b'
        };
        const relationColors = {
            '合化水': 'rgba(59,130,246,0.9)', '合化木': 'rgba(34,197,94,0.9)', '合化火': 'rgba(239,68,68,0.9)',
            '合化土': 'rgba(234,179,8,0.9)', '合化金': 'rgba(245,158,11,0.9)',
            '三合水局': 'rgba(59,130,246,0.95)', '三合火局': 'rgba(239,68,68,0.95)',
            '三合金局': 'rgba(245,158,11,0.95)', '三合木局': 'rgba(34,197,94,0.95)',
            '三合': 'rgba(16,185,129,0.9)', '相冲': 'rgba(220,38,38,0.95)',
            '相害': 'rgba(245,158,11,0.9)', '相刑': 'rgba(124,45,18,0.9)'
        };
        const relationDesc = {
            '合化水': '六合化水，情投意合', '合化木': '六合化木，生发有力',
            '合化火': '六合化火，热情奔放', '合化土': '六合化土，稳重厚实',
            '合化金': '六合化金，坚定果决',
            '三合水局': '三合水局，智慧流动', '三合火局': '三合火局，热情奔放',
            '三合金局': '三合金局，坚毅果决', '三合木局': '三合木局，生发向上',
            '三合': '三合成局，力量倍增', '相冲': '正面对冲，动荡不安',
            '相害': '暗中相害，阻滞不利', '相刑': '刑克伤害，多有波折'
        };
        const isDark = document.documentElement.classList.contains('dark');
        const nodes = data.branchGraph.nodes;
        const edges = data.branchGraph.edges;
        const hasIsolated = nodes.some(n => !edges.some(e => e.source === n.id || e.target === n.id));
        const useCircular = hasIsolated;
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
                formatter: (p) => {
                    if (p.dataType === 'node') {
                        const elementCN = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
                        return `<div style="font-weight:500;color:var(--gold);">${p.data.id}·${p.data.label}</div><div style="margin-top:4px;font-size:11px;opacity:0.8;">${elementCN[p.data.element] || p.data.element}行之气</div>`;
                    }
                    if (p.dataType === 'edge') {
                        return `<div style="font-weight:500;">${p.data.source} ${p.data.relation} ${p.data.target}</div><div style="margin-top:4px;font-size:11px;opacity:0.8;">${relationDesc[p.data.relation] || ''}</div>`;
                    }
                    return '';
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
                        formatter: (params) => `${params.data.id.replace('支', '')}\n${params.data.label}`
                    },
                    edgeSymbol: ['none', 'arrow'],
                    edgeSymbolSize: [0, 8],
                    edgeLabel: {
                        show: true,
                        color: isDark ? 'rgba(156,163,175,0.7)' : 'rgba(107,114,128,0.7)',
                        fontSize: 9,
                        fontWeight: 400,
                        formatter: (params) => params.data.relation.length > 3 ? params.data.relation.slice(0, 2) : params.data.relation
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
        };
    }, [data]);
    const branchGraphRef = useEchart(branchGraphOption);
    // 宫位图使用 Sunburst 呈现（根为日主 → 四宫 → 十神明细，现代简约风）
    const palaceGraphOption = useMemo(() => {
        if (!data)
            return { series: [] };
        const isDark = document.documentElement.classList.contains('dark');
        const tenGods = data.tenGods || {};
        const tenGodsDetail = data.tenGodsDetail || {};
        const tenGodsStrength = data.tenGodsStrength || {};
        const getGroup = (tenGod) => {
            if (!tenGod)
                return '其它';
            if (tenGod.includes('比') || tenGod.includes('劫'))
                return '兄弟';
            if (tenGod.includes('食') || tenGod.includes('伤'))
                return '子女';
            if (tenGod.includes('财'))
                return '财/妻';
            if (tenGod.includes('官') || tenGod.includes('杀'))
                return '官/夫';
            if (tenGod.includes('印'))
                return '父母';
            return '其它';
        };
        const colorOf = {
            '父母': 'rgba(99,102,241,0.95)',
            '兄弟': 'rgba(148,163,184,0.95)',
            '财/妻': 'rgba(212,175,55,0.95)',
            '官/夫': 'rgba(239,68,68,0.95)',
            '子女': 'rgba(16,185,129,0.95)',
            '其它': isDark ? 'rgba(148,163,184,0.75)' : 'rgba(71,85,105,0.85)'
        };
        const childrenRaw = [
            { key: 'year', name: '父母宫', label: `${data.year.heavenlyStem}${data.year.earthlyBranch}` },
            { key: 'month', name: '兄弟宫', label: `${data.month.heavenlyStem}${data.month.earthlyBranch}` },
            { key: 'day', name: '夫妻宫', label: `${data.day.heavenlyStem}${data.day.earthlyBranch}` },
            { key: 'hour', name: '子女宫', label: `${data.hour.heavenlyStem}${data.hour.earthlyBranch}` }
        ];
        const strengthWeight = (lvl) => lvl === 'strong' ? 1.3 : lvl === 'weak' ? 0.7 : 1.0;
        const pillarWeight = { year: 1.05, month: 1.05, day: 1.20, hour: 1.00 };
        const children = childrenRaw.map((p) => {
            const tg = tenGods?.[p.key];
            const kWeight = pillarWeight[p.key] || 1;
            const rawDetail = (tenGodsDetail?.[p.key] || []);
            // 按十神聚合并加权
            const contrib = {};
            rawDetail.forEach(d => {
                const relRaw = d?.relation;
                const rel = (relRaw && typeof relRaw === 'string' ? relRaw.trim() : '');
                if (!rel || rel.toLowerCase() === 'undefined' || rel === '-')
                    return;
                const lvl = tenGodsStrength[rel] || 'medium';
                const w = 1 * strengthWeight(lvl) * kWeight;
                contrib[rel] = (contrib[rel] || 0) + w;
            });
            if (tg && typeof tg === 'string' && tg !== '-' && tg.toLowerCase() !== 'undefined') {
                const lvlTop = tenGodsStrength[String(tg)] || 'medium';
                const wTop = 1.6 * strengthWeight(lvlTop) * kWeight;
                contrib[String(tg)] = (contrib[String(tg)] || 0) + wTop;
            }
            const entries = Object.entries(contrib).sort((a, b) => b[1] - a[1]);
            const total = entries.reduce((s, [, v]) => s + v, 0);
            const topN = entries.slice(0, 6);
            const maxV = Math.max(...topN.map(([, v]) => v), 1);
            const childrenNodes = topN.map(([rel, v]) => ({
                name: rel || '其它',
                value: Number(v.toFixed(3)),
                itemStyle: { color: colorOf[getGroup(rel) || '其它'], opacity: 0.65 + 0.3 * (v / maxV) },
                label: { show: true, formatter: `${rel || '其它'} ${v.toFixed(2)}`, width: 90, overflow: 'truncate' }
            }));
            return {
                name: p.name,
                value: Number(total.toFixed(3)) || 1,
                label: { show: true, formatter: `${p.name}\n${p.label}`, width: 100, overflow: 'truncate' },
                itemStyle: { color: colorOf[getGroup(tg)] },
                labelText: p.label,
                tenGod: tg,
                detail: entries,
                children: childrenNodes
            };
        });
        // 全量清洗，防止任何空名/undefined 名称进入图表
        const sanitizeName = (n) => {
            const s = String(n ?? '').trim();
            if (!s || s === '-' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null')
                return '其它';
            return s;
        };
        const sanitizeNodes = (nodes) => nodes
            .filter(n => n && (n.name != null || (Array.isArray(n.children) && n.children.length > 0)))
            .map(n => ({
            ...n,
            name: sanitizeName(n.name),
            children: Array.isArray(n.children) ? sanitizeNodes(n.children) : undefined
        }));
        const safeChildren = sanitizeNodes(children);
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
                formatter: (p) => {
                    const d = p.data || {};
                    if (d.name === '日主')
                        return '<b>日主</b>';
                    const lines = [
                        `<div style=\"font-weight:600;color:var(--gold)\">${d.name}</div>`,
                        d.labelText ? `<div>对应柱：${d.labelText}</div>` : '',
                        d.tenGod ? `<div>代表十神：${d.tenGod}</div>` : ''
                    ];
                    if (Array.isArray(d.detail) && d.detail.length) {
                        const parts = d.detail.slice(0, 5).map((x) => `${x[0]}×${Number(x[1]).toFixed(2)}`).join('，');
                        lines.push(`<div>构成：${parts}</div>`);
                    }
                    return lines.join('');
                }
            },
            legend: {
                bottom: 4,
                left: 'center',
                itemGap: 12,
                textStyle: { color: isDark ? '#e5e7eb' : '#374151', fontSize: 11 },
                data: children.map((c) => c.name)
            },
            series: [{
                    type: 'sunburst',
                    radius: ['28%', '84%'],
                    startAngle: 90,
                    sort: undefined,
                    nodeClick: 'rootToNode',
                    emphasis: { focus: 'ancestor' },
                    minAngle: 6,
                    label: { color: isDark ? '#f9fafb' : '#1f2937', fontSize: 12, fontWeight: 500, rotate: 0, overflow: 'truncate' },
                    labelLayout: { hideOverlap: true },
                    levels: [
                        {},
                        { r0: '28%', r: '56%', itemStyle: { borderColor: isDark ? 'rgba(17,24,39,0.35)' : 'rgba(148,163,184,0.25)', borderWidth: 1, shadowBlur: 2, shadowColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)' }, label: { overflow: 'truncate', rotate: 0, fontWeight: 600, width: 100 }, labelLayout: { hideOverlap: true } },
                        { r0: '56%', r: '84%', itemStyle: { borderColor: isDark ? 'rgba(17,24,39,0.25)' : 'rgba(148,163,184,0.2)', borderWidth: 1 }, label: { overflow: 'truncate', rotate: 0, width: 90 }, labelLayout: { hideOverlap: true } }
                    ],
                    data: [{ name: '日主', value: 4, itemStyle: { color: '#d4af37' }, children: safeChildren }]
                }]
        };
    }, [data]);
    const palaceGraphRef = useEchart(palaceGraphOption);
    // 六亲图使用 Sankey（连线宽度按量化值衡量）
    const kinGraphOption = useMemo(() => {
        if (!data)
            return { series: [] };
        const isDark = document.documentElement.classList.contains('dark');
        const detail = data.tenGodsDetail || {};
        const tenGods = data.tenGods || {};
        const tenGodsStrength = data.tenGodsStrength || {};
        const buckets = { '父母': 0, '兄弟': 0, '官/夫': 0, '财/妻': 0, '子女': 0 };
        const bucketsScore = { '父母': 0, '兄弟': 0, '官/夫': 0, '财/妻': 0, '子女': 0 };
        const groupOf = (rel) => {
            if (!rel)
                return null;
            if (rel.includes('比') || rel.includes('劫'))
                return '兄弟';
            if (rel.includes('食') || rel.includes('伤'))
                return '子女';
            if (rel.includes('财'))
                return '财/妻';
            if (rel.includes('官') || rel.includes('杀'))
                return '官/夫';
            if (rel.includes('印'))
                return '父母';
            return null;
        };
        const strengthWeight = (lvl) => lvl === 'strong' ? 1.3 : lvl === 'weak' ? 0.7 : 1.0;
        const pillarWeight = { year: 1.05, month: 1.05, day: 1.20, hour: 1.00 };
        const contrib = { '父母': {}, '兄弟': {}, '官/夫': {}, '财/妻': {}, '子女': {} };
        ['year', 'month', 'day', 'hour'].forEach((k) => {
            const arr = detail?.[k] || [];
            const kWeight = pillarWeight[k];
            arr.forEach((it) => {
                const rel = String(it.relation || '');
                const g = groupOf(rel);
                if (!g)
                    return;
                buckets[g] += 1;
                const sLvl = tenGodsStrength[rel] || 'medium';
                const w = 1 * strengthWeight(sLvl) * kWeight;
                bucketsScore[g] += w;
                contrib[g][rel] = (contrib[g][rel] || 0) + w;
            });
            // 顶层十神额外权重（代表性更强）
            const topRel = tenGods?.[k];
            const gTop = groupOf(String(topRel || ''));
            if (gTop) {
                const sLvlTop = tenGodsStrength[String(topRel)] || 'medium';
                const wTop = 1.5 * strengthWeight(sLvlTop) * kWeight;
                bucketsScore[gTop] += wTop;
                contrib[gTop][String(topRel)] = (contrib[gTop][String(topRel)] || 0) + wTop;
            }
        });
        const colorOf = {
            '父母': 'rgba(99,102,241,0.95)',
            '兄弟': 'rgba(148,163,184,0.95)',
            '财/妻': 'rgba(212,175,55,0.95)',
            '官/夫': 'rgba(239,68,68,0.95)',
            '子女': 'rgba(16,185,129,0.95)'
        };
        const nodes = [
            { name: '日主', label: { position: 'left', color: isDark ? '#e5e7eb' : '#374151', fontSize: 12, fontWeight: 600 } },
            ...Object.keys(buckets).map(k => ({ name: k, label: { position: 'right', align: 'left', color: isDark ? '#e5e7eb' : '#374151', fontSize: 12, fontWeight: 500 } }))
        ];
        const minShow = 0.001;
        const links = Object.keys(bucketsScore).map(k => ({
            source: '日主',
            target: k,
            value: Math.max(minShow, Number(bucketsScore[k].toFixed(3))),
            raw: buckets[k],
            score: bucketsScore[k],
            detail: Object.entries(contrib[k]).sort((a, b) => b[1] - a[1]).slice(0, 3)
        }));
        const total = Object.values(bucketsScore).reduce((a, b) => a + b, 0);
        const scale = total > 0 ? 100 / total : 0;
        const normalizedLinks = links.map(l => ({ ...l, value: Math.max(minShow, Number((l.value * scale).toFixed(2))), scoreNorm: (l.score || 0) * scale }));
        const totalNorm = 100;
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
                formatter: (p) => {
                    if (p.dataType === 'edge') {
                        const score = p.data.score || 0;
                        const scoreNorm = p.data.scoreNorm || (scale > 0 ? score * scale : 0);
                        const percent = totalNorm > 0 ? (scoreNorm / totalNorm * 100).toFixed(1) : '0.0';
                        const parts = (p.data.detail || []).map((x) => `${x[0]}×${x[1].toFixed(2)}`).join('，');
                        return `<div style="font-weight:600;color:var(--gold)">${p.data.target}</div>` +
                            `<div>量化值（0-100）：<b>${scoreNorm.toFixed(2)}</b>（${percent}%）</div>` +
                            (parts ? `<div class="mt-1">构成：${parts}</div>` : '');
                    }
                    if (p.dataType === 'node') {
                        if (p.name === '日主')
                            return `<div style="font-weight:600;color:var(--gold)">日主</div><div>总计：${total}</div>`;
                        const score = bucketsScore[p.name] || 0;
                        const scoreNorm = scale > 0 ? score * scale : 0;
                        const percent = totalNorm > 0 ? (scoreNorm / totalNorm * 100).toFixed(1) : '0.0';
                        return `<div style="font-weight:600;color:var(--gold)">${p.name}</div><div>量化值（0-100）：${scoreNorm.toFixed(2)}（${percent}%）</div>`;
                    }
                    return '';
                }
            },
            legend: {
                top: 2,
                right: 6,
                itemGap: 10,
                textStyle: { color: isDark ? '#e5e7eb' : '#374151', fontSize: 11 },
                data: Object.keys(buckets)
            },
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
                    links: normalizedLinks.map(l => ({ ...l, lineStyle: { color: colorOf[l.target] || '#94a3b8', opacity: 0.95 } }))
                }]
        };
    }, [data]);
    const kinGraphRef = useEchart(kinGraphOption);
    // 当图谱 Tab 切换时，强制触发对应 ECharts 实例 resize，保证在隐藏->显示后仍然正确居中
    useEffect(() => {
        const tryResize = (refAny) => {
            const el = refAny?.current;
            if (!el)
                return;
            const inst = echarts.getInstanceByDom(el);
            if (inst)
                inst.resize();
        };
        if (graphTab === 'stem')
            tryResize(graphRef);
        if (graphTab === 'branch')
            tryResize(branchGraphRef);
        if (graphTab === 'palace')
            tryResize(palaceGraphRef);
        if (graphTab === 'kin')
            tryResize(kinGraphRef);
    }, [graphTab]);
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
    return (_jsxs("div", { className: "min-h-screen", children: [_jsxs("header", { className: "px-6 py-4 border-b border-gray-800 flex items-center justify-between", children: [_jsxs("h1", { className: "text-xl tracking-widest gold", children: ["DESTINY \u00B7 ", t('title')] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: exportPDF, className: "btn text-xs", children: t('export') }), _jsx("button", { onClick: () => setIsDark(v => !v), className: "btn text-xs", title: t('theme'), children: isDark ? t('dark') : t('light') }), _jsxs("select", { value: lang, onChange: e => setLang(e.target.value), className: "select text-xs", children: [_jsx("option", { value: "zh", children: "\u4E2D\u6587" }), _jsx("option", { value: "en", children: "EN" })] })] })] }), _jsxs("main", { className: "px-10 py-4 grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("section", { className: "card p-4 lg:col-span-1", children: [_jsx("h2", { className: "mb-3 text-sm text-gray-300", children: t('input') }), _jsxs("form", { className: "space-y-3", onSubmit: onSubmit, children: [error && _jsx("div", { className: "alert alert-error", children: error }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('datetime') }), _jsx("input", { className: "w-full input", type: "datetime-local", value: form.datetime, onChange: e => setForm(prev => ({ ...prev, datetime: e.target.value })) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('timezone') }), _jsx("input", { className: "w-full input", placeholder: "Asia/Shanghai", value: form.timezone, onChange: e => setForm(prev => ({ ...prev, timezone: e.target.value })) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { id: "trueSolar", type: "checkbox", className: "h-4 w-4", checked: form.useTrueSolarTime, onChange: e => setForm(prev => ({ ...prev, useTrueSolarTime: e.target.checked })) }), _jsx("label", { htmlFor: "trueSolar", className: "text-xs muted", children: t('trueSolar') })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('latitude') }), _jsx("input", { className: "w-full input", placeholder: "31.23", value: form.lat, onChange: e => setForm(prev => ({ ...prev, lat: e.target.value })), disabled: !form.useTrueSolarTime })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('longitude') }), _jsx("input", { className: "w-full input", placeholder: "121.47", value: form.lon, onChange: e => setForm(prev => ({ ...prev, lon: e.target.value })), disabled: !form.useTrueSolarTime })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs muted mb-1", children: t('gender') }), _jsxs("select", { className: "w-full select", value: form.gender, onChange: e => setForm(prev => ({ ...prev, gender: e.target.value })), children: [_jsx("option", { value: "male", children: t('male') }), _jsx("option", { value: "female", children: t('female') })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { disabled: loading, className: "flex-1 btn btn-primary mt-2", children: loading ? t('calculating') : t('submit') }), _jsx("button", { type: "button", onClick: () => {
                                                    const p = { id: `${Date.now()}`, datetime: form.datetime, timezone: form.timezone, gender: form.gender, createdAt: Date.now() };
                                                    const next = [p, ...profiles].slice(0, 20);
                                                    setProfiles(next);
                                                    localStorage.setItem(LS_KEY, JSON.stringify(next));
                                                }, className: "btn text-xs mt-2", children: t('save') })] })] }), profiles.length > 0 && (_jsxs("div", { className: "mt-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "text-xs text-gray-400", children: t('history') }), _jsx("button", { onClick: clearHistory, className: "text-[10px] text-gray-400", children: "\u6E05\u7A7A" })] }), _jsx("div", { className: "space-y-2 max-h-60 overflow-y-auto pr-1", children: profiles.map(p => (_jsxs("div", { className: "list-item", children: [_jsx("div", { className: "text-xs muted", children: p.datetime.replace('T', ' ') }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "chip", children: p.gender === 'male' ? '男' : '女' }), _jsx("button", { onClick: () => loadProfile(p), className: "btn text-[10px] px-2 py-0.5", children: "\u52A0\u8F7D" })] })] }, p.id))) })] }))] }), _jsxs("section", { className: "card card-stretch p-4 lg:col-span-2", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h2", { className: "text-sm muted", children: t('five') }), data && (_jsxs("div", { className: "text-[11px] muted flex gap-2", children: [_jsxs("span", { className: "chip", style: { color: ELEMENT_COLOR.wood }, children: ["\u6728 ", data.fiveElementPower.wood.toFixed(2)] }), _jsxs("span", { className: "chip", style: { color: ELEMENT_COLOR.fire }, children: ["\u706B ", data.fiveElementPower.fire.toFixed(2)] }), _jsxs("span", { className: "chip", style: { color: ELEMENT_COLOR.earth }, children: ["\u571F ", data.fiveElementPower.earth.toFixed(2)] }), _jsxs("span", { className: "chip", style: { color: ELEMENT_COLOR.metal }, children: ["\u91D1 ", data.fiveElementPower.metal.toFixed(2)] }), _jsxs("span", { className: "chip", style: { color: ELEMENT_COLOR.water }, children: ["\u6C34 ", data.fiveElementPower.water.toFixed(2)] })] }))] }), _jsx("div", { className: "radar-box", children: _jsx("div", { ref: enhancedRadarRef, style: { width: '100%', height: '100%' } }) }), _jsx("div", { className: "panel-note-fixed text-xs muted", children: "\u63D0\u793A\uFF1A\u9F20\u6807\u60AC\u505C\u67E5\u770B\u5404\u9879\u5177\u4F53\u6570\u503C\uFF1B\"\u6728/\u706B/\u571F/\u91D1/\u6C34\"\u5206\u522B\u5BF9\u5E94\u751F\u53D1/\u708E\u4E0A/\u7A3C\u7A51/\u8083\u6740/\u6DA6\u4E0B\u3002" })] }), data && (_jsxs("section", { className: "card p-4 lg:col-span-3", children: [_jsx("h2", { className: "mb-3 text-sm muted", children: t('bazi') }), _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4 text-center", children: [
                                    { label: '年柱', p: data.year },
                                    { label: '月柱', p: data.month },
                                    { label: '日柱', p: data.day },
                                    { label: '时柱', p: data.hour }
                                ].map((x, i) => {
                                    const elMap = { '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire', '戊': 'earth', '己': 'earth', '庚': 'metal', '辛': 'metal', '壬': 'water', '癸': 'water' };
                                    const el = elMap[x.p.heavenlyStem] || 'earth';
                                    return (_jsxs("div", { className: "p-5 rounded-card pillar-card pillar", "data-el": el, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("div", { className: "pillar-tag", children: x.label }), _jsx("span", { className: "pillar-badge", "data-el": el, children: ELEMENT_CN[el] || el })] }), _jsxs("div", { className: "pillar-han text-3xl tracking-widest tooltip", children: [_jsx("span", { style: { color: ELEMENT_COLOR[el] }, children: x.p.heavenlyStem }), _jsx("span", { style: { color: ELEMENT_COLOR[BRANCH_ELEMENT[x.p.earthlyBranch] || 'earth'] }, children: x.p.earthlyBranch }), _jsxs("div", { className: "tooltip-content text-left", children: [_jsxs("div", { children: ["\u7EB3\u97F3\uFF1A", x.p.naYin || '-'] }), _jsxs("div", { children: ["\u85CF\u5E72\uFF1A", (x.p.hiddenStems || []).join('、') || '-'] })] })] })] }, i));
                                }) }), _jsxs("div", { className: "mt-6 grid md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsxs("div", { className: "text-xs muted mb-2 tooltip", children: ["\u5341\u795E", _jsx("div", { className: "tooltip-content", children: "\u4EE5\u65E5\u4E3B\u4E3A\u4E2D\u5FC3\u7684\u5341\u79CD\u5173\u7CFB\uFF1A\u6BD4\u52AB\u3001\u98DF\u4F24\u3001\u8D22\u3001\u5B98\u6740\u3001\u5370\uFF0C\u9634\u9633\u4E0E\u751F\u514B\u51B3\u5B9A\u5177\u4F53\u79F0\u8C13\u3002" })] }), _jsxs("div", { className: "grid grid-cols-4 gap-3 text-center text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u5E74" }), _jsxs("div", { children: [data.tenGods?.year || '-', data.tenGodsStrength && data.tenGods?.year && (() => {
                                                                        const lvl = data.tenGodsStrength[data.tenGods.year] || 'medium';
                                                                        const txt = lvl === 'strong' ? '强' : (lvl === 'weak' ? '弱' : '中');
                                                                        const tip = lvl === 'strong' ? '偏旺（强）' : (lvl === 'weak' ? '偏弱（弱）' : '中等（中）');
                                                                        return (_jsxs("span", { className: "tooltip", children: [_jsx("span", { className: `ml-2 badge badge-${lvl}`, children: txt }), _jsx("div", { className: "tooltip-content", children: tip })] }));
                                                                    })()] }), _jsx("div", { className: "text-[11px] muted mt-1", children: data.tenGodsDetail?.year?.map((d) => `${d.stem}${d.relation}`).join('、') || '' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u6708" }), _jsxs("div", { children: [data.tenGods?.month || '-', data.tenGodsStrength && data.tenGods?.month && (() => {
                                                                        const lvl = data.tenGodsStrength[data.tenGods.month] || 'medium';
                                                                        const txt = lvl === 'strong' ? '强' : (lvl === 'weak' ? '弱' : '中');
                                                                        const tip = lvl === 'strong' ? '偏旺（强）' : (lvl === 'weak' ? '偏弱（弱）' : '中等（中）');
                                                                        return (_jsxs("span", { className: "tooltip", children: [_jsx("span", { className: `ml-2 badge badge-${lvl}`, children: txt }), _jsx("div", { className: "tooltip-content", children: tip })] }));
                                                                    })()] }), _jsx("div", { className: "text-[11px] muted mt-1", children: data.tenGodsDetail?.month?.map((d) => `${d.stem}${d.relation}`).join('、') || '' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65E5" }), _jsxs("div", { children: ["\u65E5\u4E3B", data.advice && (() => {
                                                                        const lvlRaw = (data.advice.strength || 'balanced');
                                                                        const lvl = lvlRaw === 'balanced' ? 'medium' : lvlRaw;
                                                                        const txt = lvl === 'strong' ? '强' : (lvl === 'weak' ? '弱' : '中');
                                                                        const tip = lvl === 'strong' ? '偏旺（强）' : (lvl === 'weak' ? '偏弱（弱）' : '中等（中）');
                                                                        return (_jsxs("span", { className: "tooltip", children: [_jsx("span", { className: `ml-2 badge badge-${lvl}`, children: txt }), _jsx("div", { className: "tooltip-content", children: tip })] }));
                                                                    })()] }), _jsx("div", { className: "text-[11px] muted mt-1", children: data.tenGodsDetail?.day?.map((d) => `${d.stem}${d.relation}`).join('、') || '' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65F6" }), _jsxs("div", { children: [data.tenGods?.hour || '-', data.tenGodsStrength && data.tenGods?.hour && (() => {
                                                                        const lvl = data.tenGodsStrength[data.tenGods.hour] || 'medium';
                                                                        const txt = lvl === 'strong' ? '强' : (lvl === 'weak' ? '弱' : '中');
                                                                        const tip = lvl === 'strong' ? '偏旺（强）' : (lvl === 'weak' ? '偏弱（弱）' : '中等（中）');
                                                                        return (_jsxs("span", { className: "tooltip", children: [_jsx("span", { className: `ml-2 badge badge-${lvl}`, children: txt }), _jsx("div", { className: "tooltip-content", children: tip })] }));
                                                                    })()] }), _jsx("div", { className: "text-[11px] muted mt-1", children: data.tenGodsDetail?.hour?.map((d) => `${d.stem}${d.relation}`).join('、') || '' })] })] })] }), _jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsx("div", { className: "text-xs muted mb-2", children: "\u85CF\u5E72" }), _jsxs("div", { className: "grid grid-cols-4 gap-2 text-center text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u5E74" }), _jsx("div", { children: (data.year.hiddenStems || []).join('、') || '-' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u6708" }), _jsx("div", { children: (data.month.hiddenStems || []).join('、') || '-' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65E5" }), _jsx("div", { children: (data.day.hiddenStems || []).join('、') || '-' })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65F6" }), _jsx("div", { children: (data.hour.hiddenStems || []).join('、') || '-' })] })] })] }), _jsxs("div", { className: "md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsx("div", { className: "text-xs muted mb-1", children: "\u65E5\u4E3B" }), _jsx("div", { className: "text-lg text-center", children: _jsx("span", { style: { color: ELEMENT_COLOR[data.advice?.dayMaster.element || 'earth'] || 'var(--gold)' }, children: data.advice?.dayMaster.stem }) })] }), _jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsx("div", { className: "text-xs muted mb-1", children: "\u5F3A\u5F31" }), _jsx("div", { className: "text-sm text-center", children: _jsxs("span", { className: "tooltip inline-block", children: [data.advice?.strength === 'weak' ? '偏弱' : data.advice?.strength === 'strong' ? '偏旺' : '中和', _jsx("div", { className: "tooltip-content", children: data.advice?.notes })] }) })] }), _jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsx("div", { className: "text-xs muted mb-1", children: "\u559C\u7528" }), _jsx("div", { className: "text-sm text-center", children: (data.advice?.favorable || []).map(e => ELEMENT_CN[e] || e).join('、') })] }), _jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsx("div", { className: "text-xs muted mb-1", children: "\u5FCC\u8BB3" }), _jsx("div", { className: "text-sm text-center", children: (data.advice?.avoid || []).length > 0 ? (data.advice?.avoid || []).map(e => ELEMENT_CN[e] || e).join('、') : '无' })] })] }), _jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsxs("div", { className: "text-xs muted mb-2 tooltip", children: ["\u661F\u8FD0", _jsx("div", { className: "tooltip-content", children: "\u5404\u67F1\u5929\u5E72\u5BF9\u672C\u67F1\u5730\u652F\u7684\u5341\u4E8C\u957F\u751F\u72B6\u6001\uFF0C\u53CD\u6620\u8BE5\u67F1\u81EA\u8EAB\u7684\u65FA\u8870\u3002" })] }), _jsx("div", { className: "grid grid-cols-4 gap-2 text-center text-sm", children: [
                                                    { label: '年', stem: data.year.heavenlyStem, branch: data.year.earthlyBranch },
                                                    { label: '月', stem: data.month.heavenlyStem, branch: data.month.earthlyBranch },
                                                    { label: '日', stem: data.day.heavenlyStem, branch: data.day.earthlyBranch },
                                                    { label: '时', stem: data.hour.heavenlyStem, branch: data.hour.earthlyBranch }
                                                ].map((x, i) => {
                                                    const stage = changShengOf(x.stem, x.branch);
                                                    return (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: x.label }), _jsxs("div", { className: "tooltip inline-block", children: [stage || '—', stage && (_jsxs("div", { className: "tooltip-content", children: [_jsxs("div", { className: "font-semibold", children: [x.stem, "\u5E72\u5728", x.branch, "\u652F\uFF1A", stage] }), _jsx("div", { className: "mt-1", children: CHANGSHENG_DESC[stage] || stage })] }))] })] }, i));
                                                }) })] }), _jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsxs("div", { className: "text-xs muted mb-2 tooltip", children: ["\u81EA\u5750", _jsx("div", { className: "tooltip-content", children: "\u4EE5\u65E5\u4E3B\u4E3A\u57FA\u51C6\uFF0C\u5206\u522B\u67E5\u770B\u56DB\u67F1\u4E0E\u65E5\u4E3B\u4E4B\u95F4\u7684\u5341\u4E8C\u957F\u751F\u9636\u6BB5\u3002" })] }), _jsx("div", { className: "grid grid-cols-4 gap-2 text-center text-sm", children: [
                                                    { label: '年', branch: data.year.earthlyBranch },
                                                    { label: '月', branch: data.month.earthlyBranch },
                                                    { label: '日', branch: data.day.earthlyBranch },
                                                    { label: '时', branch: data.hour.earthlyBranch }
                                                ].map((x, i) => {
                                                    const stage = changShengOf(data.day.heavenlyStem, x.branch);
                                                    return (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: x.label }), _jsxs("div", { className: "tooltip inline-block", children: [stage || '—', stage && (_jsxs("div", { className: "tooltip-content", children: [_jsxs("div", { className: "font-semibold", children: ["\u65E5\u4E3B", data.day.heavenlyStem, "\u5728", x.branch, "\u652F\uFF1A", stage] }), _jsx("div", { className: "mt-1", children: CHANGSHENG_DESC[stage] || stage })] }))] })] }, i));
                                                }) })] }), _jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsxs("div", { className: "text-xs muted mb-2 tooltip", children: ["\u7A7A\u4EA1", _jsx("div", { className: "tooltip-content", children: NOTE_XUNKONG })] }), _jsx("div", { className: "grid grid-cols-4 gap-2 text-center text-sm", children: [
                                                    { label: '年', pillar: data.year, xunKong: data.xunKong?.year || [] },
                                                    { label: '月', pillar: data.month, xunKong: data.xunKong?.month || [] },
                                                    { label: '日', pillar: data.day, xunKong: data.xunKong?.day || [] },
                                                    { label: '时', pillar: data.hour, xunKong: data.xunKong?.hour || [] }
                                                ].map((item, i) => {
                                                    const isEmpty = item.xunKong.includes(item.pillar.earthlyBranch);
                                                    const emptyBranches = item.xunKong;
                                                    return (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: item.label }), _jsxs("div", { className: "tooltip inline-block", children: [_jsx("div", { className: "flex gap-1 justify-center", children: emptyBranches.map((branch, j) => (_jsx("span", { className: `text-xs px-1 py-0.5 rounded border ${branch === item.pillar.earthlyBranch
                                                                                ? 'bg-red-500/20 border-red-500/50 text-red-400 font-bold'
                                                                                : 'border-gray-600 text-gray-400'}`, children: branch }, j))) }), _jsxs("div", { className: "tooltip-content", children: [_jsxs("div", { children: ["\u672C\u67F1\u7A7A\u4EA1\uFF1A", emptyBranches.join('、')] }), isEmpty && _jsx("div", { className: "mt-1", children: XUNKONG_DESC[item.pillar.earthlyBranch] || `${item.pillar.earthlyBranch}支空亡，力量减弱` }), !isEmpty && _jsx("div", { className: "mt-1", children: "\u672C\u67F1\u5730\u652F\u4E0D\u9022\u7A7A\u4EA1\uFF0C\u529B\u91CF\u6B63\u5E38" })] })] })] }, i));
                                                }) })] }), _jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)]", children: [_jsxs("div", { className: "text-xs muted mb-2 tooltip", children: ["\u7EB3\u97F3", _jsx("div", { className: "tooltip-content", children: NOTE_NAYIN })] }), _jsxs("div", { className: "grid grid-cols-4 gap-2 text-center text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u5E74" }), _jsxs("div", { className: "tooltip inline-block", children: [data.year.naYin || '-', _jsx("div", { className: "tooltip-content", children: NAYIN_DESC[data.year.naYin] || data.year.naYin || '-' })] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u6708" }), _jsxs("div", { className: "tooltip inline-block", children: [data.month.naYin || '-', _jsx("div", { className: "tooltip-content", children: NAYIN_DESC[data.month.naYin] || data.month.naYin || '-' })] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65E5" }), _jsxs("div", { className: "tooltip inline-block", children: [data.day.naYin || '-', _jsx("div", { className: "tooltip-content", children: NAYIN_DESC[data.day.naYin] || data.day.naYin || '-' })] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: "\u65F6" }), _jsxs("div", { className: "tooltip inline-block", children: [data.hour.naYin || '-', _jsx("div", { className: "tooltip-content", children: NAYIN_DESC[data.hour.naYin] || data.hour.naYin || '-' })] })] })] })] }), (() => {
                                        const pillars = [data.year, data.month, data.day, data.hour].map(p => ({ branch: p.earthlyBranch }));
                                        const localStars = computeShenShaPositions(pillars, data.day.earthlyBranch);
                                        const merged = new Map();
                                        const add = (name, hits) => {
                                            if (!merged.has(name))
                                                merged.set(name, new Set());
                                            const s = merged.get(name);
                                            hits.forEach(h => s.add(h));
                                        };
                                        localStars.forEach(s => add(s.name, s.hits));
                                        (data.stars || []).forEach(s => add(s.name, s.hits));
                                        const shensha = Array.from(merged.entries()).map(([name, set]) => ({
                                            name,
                                            hits: Array.from(set),
                                            group: (data.stars || []).find((x) => x.name === name)?.group || (['天乙贵人', '文昌'].includes(name) ? '贵人' : ['羊刃'].includes(name) ? '煞曜' : '吉曜')
                                        }));
                                        const groupVariant = (g) => g === '贵人' ? 'good' : (g === '煞曜' ? 'evil' : 'neutral');
                                        const byPillar = { '年': [], '月': [], '日': [], '时': [] };
                                        shensha.forEach(s => {
                                            s.hits.forEach(h => { if (byPillar[h])
                                                byPillar[h].push({ name: s.name, group: s.group }); });
                                        });
                                        const cols = [
                                            { label: '年', items: byPillar['年'] },
                                            { label: '月', items: byPillar['月'] },
                                            { label: '日', items: byPillar['日'] },
                                            { label: '时', items: byPillar['时'] }
                                        ];
                                        return (_jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)] md:col-span-2", children: [_jsxs("div", { className: "text-xs muted mb-2 tooltip", children: ["\u795E\u715E", _jsxs("div", { className: "tooltip-content", children: [_jsx("div", { children: "\u989C\u8272\u542B\u4E49\uFF1A" }), _jsxs("div", { className: "mt-1 flex gap-2 justify-center", children: [_jsx("span", { className: "ss-badge ss-sm ss-good", children: "\u8D35\u4EBA" }), _jsx("span", { className: "ss-badge ss-sm ss-neutral", children: "\u5409\u66DC" }), _jsx("span", { className: "ss-badge ss-sm ss-evil", children: "\u715E\u66DC" })] }), _jsx("div", { className: "text-[11px] muted mt-1", children: "\u7EFF=\u52A9\u76CA\uFF0C\u84DD=\u4E2D\u6027/\u8F85\u52A9\uFF0C\u7EA2=\u9700\u5236\u5316" })] })] }), _jsx("div", { className: "grid grid-cols-4 gap-3 text-center text-sm", children: cols.map((c, i) => (_jsxs("div", { children: [_jsx("div", { className: "text-[10px] muted", children: c.label }), _jsx("div", { className: "mt-1 flex flex-col items-center gap-2", children: c.items.length > 0 ? c.items.map((it, j) => (_jsxs("span", { className: `ss-badge ss-${groupVariant(it.group)} tooltip tooltip-top`, children: [it.name, _jsx("div", { className: "tooltip-content", children: STAR_DESC[it.name] || it.name })] }, j))) : _jsx("span", { className: "text-[11px] muted", children: "\u2014" }) })] }, i))) })] }));
                                    })(), (data.graph || data.branchGraph) && (_jsxs("div", { className: "p-4 rounded-card bg-[var(--card)] border border-[var(--border)] md:col-span-2", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "text-xs muted tooltip", children: ["\u5E72\u652F\u667A\u80FD\u56FE\u8C31", _jsxs("div", { className: "tooltip-content", children: [_jsx("div", { children: "\u56DB\u67F1\u5E72\u652F\u5173\u7CFB\u56FE\uFF0C\u663E\u793A\u751F\u514B\u5408\u51B2\u7B49\u5173\u7CFB" }), _jsx("div", { className: "mt-1", children: "\u5173\u7CFB\u5F3A\u5F31\u5F71\u54CD\u547D\u5C40\u5E73\u8861\u4E0E\u683C\u5C40\u9AD8\u4F4E" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setGraphTab('stem'), className: `text-xs px-2 py-1 rounded ${graphTab === 'stem' ? 'bg-gold text-black' : 'text-muted hover:text-fg'}`, children: "\u5929\u5E72" }), _jsx("button", { onClick: () => setGraphTab('branch'), className: `text-xs px-2 py-1 rounded ${graphTab === 'branch' ? 'bg-gold text-black' : 'text-muted hover:text-fg'}`, children: "\u5730\u652F" }), _jsx("button", { onClick: () => setGraphTab('palace'), className: `text-xs px-2 py-1 rounded ${graphTab === 'palace' ? 'bg-gold text-black' : 'text-muted hover:text-fg'}`, children: "\u5BAB\u4F4D" }), _jsx("button", { onClick: () => setGraphTab('kin'), className: `text-xs px-2 py-1 rounded ${graphTab === 'kin' ? 'bg-gold text-black' : 'text-muted hover:text-fg'}`, children: "\u516D\u4EB2" })] })] }), _jsxs("div", { className: "w-full", style: { minHeight: 320, display: 'grid', placeItems: 'center' }, children: [_jsx("div", { style: { width: '100%', height: 320, display: graphTab === 'stem' ? 'block' : 'none' }, children: _jsx("div", { ref: graphRef, style: { width: '100%', height: '100%' } }) }), _jsx("div", { style: { width: '100%', height: 320, display: graphTab === 'branch' ? 'block' : 'none' }, children: _jsx("div", { ref: branchGraphRef, style: { width: '100%', height: '100%' } }) }), _jsx("div", { style: { width: '100%', height: 320, display: graphTab === 'palace' ? 'block' : 'none' }, children: _jsx("div", { ref: palaceGraphRef, style: { width: '100%', height: '100%' } }) }), _jsx("div", { style: { width: '100%', height: 320, display: graphTab === 'kin' ? 'block' : 'none' }, children: _jsx("div", { ref: kinGraphRef, style: { width: '100%', height: '100%' } }) })] }), _jsx("div", { className: "text-[11px] muted mt-2", children: graphTab === 'stem' ? (_jsxs("div", { children: [_jsx("div", { children: "\u8BF4\u660E\uFF1A\u65E5\u67F1\u5C45\u4E2D\uFF0C\u663E\u793A\u56DB\u67F1\u5929\u5E72\u95F4\u7684\u4E94\u884C\u751F\u514B\u5173\u7CFB" }), _jsxs("div", { className: "mt-1", children: [_jsx("span", { className: "inline-block w-2 h-2 bg-green-500 rounded mr-1" }), "\u751F\uFF1A\u76F8\u751F\u52A9\u529B", _jsx("span", { className: "inline-block w-2 h-2 bg-red-500 rounded mr-1 ml-3" }), "\u514B\uFF1A\u76F8\u514B\u5236\u7EA6", _jsx("span", { className: "inline-block w-2 h-2 bg-gray-500 rounded mr-1 ml-3" }), "\u540C\uFF1A\u540C\u6C14\u76F8\u6C42"] })] })) : graphTab === 'branch' ? (_jsxs("div", { children: [_jsx("div", { children: "\u8BF4\u660E\uFF1A\u663E\u793A\u56DB\u67F1\u5730\u652F\u95F4\u7684\u5408\u51B2\u5211\u5BB3\u5173\u7CFB" }), _jsxs("div", { className: "mt-1", children: [_jsx("span", { className: "inline-block w-2 h-2 bg-green-500 rounded mr-1" }), "\u5408\uFF1A\u516D\u5408\u4E09\u5408", _jsx("span", { className: "inline-block w-2 h-2 bg-red-600 rounded mr-1 ml-3" }), "\u51B2\uFF1A\u76F8\u51B2\u5BF9\u7ACB", _jsx("span", { className: "inline-block w-2 h-2 bg-orange-500 rounded mr-1 ml-3" }), "\u5BB3\uFF1A\u76F8\u5BB3\u963B\u6EDE", _jsx("span", { className: "inline-block w-2 h-2 bg-amber-700 rounded mr-1 ml-3" }), "\u5211\uFF1A\u76F8\u5211\u6CE2\u6298"] })] })) : graphTab === 'palace' ? (_jsxs("div", { children: [_jsx("div", { children: "\u8BF4\u660E\uFF1A\u4EE5\u65E5\u4E3B\u4E3A\u4E2D\u5FC3\uFF0C\u56DB\u67F1\u6620\u5C04\u81F3\u7236\u6BCD/\u5144\u5F1F/\u592B\u59BB/\u5B50\u5973\u5BAB\u4F4D\uFF1B\u8FB9\u6807\u6CE8\u5BF9\u5E94\u5341\u795E\u3002" }), _jsxs("div", { className: "mt-1", children: [_jsx("span", { className: "inline-block w-2 h-2 bg-indigo-500 rounded mr-1" }), "\u7236\u6BCD", _jsx("span", { className: "inline-block w-2 h-2 bg-slate-400 rounded mr-1 ml-3" }), "\u5144\u5F1F", _jsx("span", { className: "inline-block w-2 h-2 bg-amber-400 rounded mr-1 ml-3" }), "\u8D22/\u59BB", _jsx("span", { className: "inline-block w-2 h-2 bg-red-500 rounded mr-1 ml-3" }), "\u5B98/\u592B", _jsx("span", { className: "inline-block w-2 h-2 bg-emerald-500 rounded mr-1 ml-3" }), "\u5B50\u5973"] })] })) : graphTab === 'kin' ? (_jsx("div", { children: _jsx("div", { children: "\u8BF4\u660E\uFF1A\u516D\u4EB2\u5F3A\u5F31\u4E3A\u7EFC\u5408\u91CF\u5316\u503C\uFF080\u2013100 \u6807\u51C6\u5316\uFF09\u3002\u6765\u6E90\uFF1A\u5341\u795E\u660E\u7EC6\u52A0\u6743\uFF08\u5F3A/\u4E2D/\u5F31\u3001\u5E74/\u6708/\u65E5/\u65F6\u4E0E\u4EE3\u8868\u5341\u795E\u6743\u91CD\uFF09\uFF0C\u8FDE\u7EBF\u7C97\u7EC6\u4E0E\u989C\u8272\u4F53\u73B0\u76F8\u5BF9\u5F3A\u5EA6\u3002" }) })) : null })] }))] })] })), timeline && (_jsxs("section", { className: "card p-4 lg:col-span-3", children: [_jsx("h2", { className: "mb-3 text-sm text-gray-300", children: t('chart_months') }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-6 gap-3 text-center", children: timeline.map((m, i) => (_jsxs("div", { className: "p-3 rounded border border-[var(--border)] bg-[var(--card)]", children: [_jsxs("div", { className: "text-xs muted", children: [m.month, "\u6708"] }), _jsx("div", { className: "gold text-lg tracking-widest", children: m.pillar })] }, i))) })] }))] })] }));
}
//# sourceMappingURL=App.js.map