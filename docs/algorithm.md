BaZi Calculation Design

Inputs

- Datetime (ISO/local) + IANA timezone
- Calendar: Gregorian/Lunar
- Gender (for 大运顺逆)
- Location (optional; reserved for真太阳时/黄经修正)

Steps

1) Normalize time
- Convert input to timezone-aware moment.
- Produce Solar(公历) date-time.

2) Obtain Lunar and EightChar
- Use Lunar.fromDate(Solar) to get 阴历、节气、旬空。
- EightChar.fromLunar(lunar) → 年柱、月柱、日柱、时柱。

3) Hidden stems, 纳音、旬空
- Map 地支→藏干表。
- 甲子60甲子→纳音查表。
- 旬空：lunar.getXunKong()。

4) 十神计算（简化版）
- 以日干为主，干支五行生克推导十神。
- Library: EightChar provides getYearShiShen()/getMonthShiShen()/getTimeShiShen()。

5) 大运/流年
- gender 决定顺逆。
- lunar.getDaYun(gender) → 开始年龄/年份与干支。
- 流年：从首运起10年获取 getLiuNian()。

6) 五行强弱估算（占位）
- 以四柱天干映射五行计数。
- 后续替换为“月令得令/通根/透出/生助/制化”模型与季节权重函数。

Edge Cases

- 时区跨日导致年月日变化。
- 节气临界（精确到分）。lunar-javascript 已内置。
- 农历闰月：Lunar API 处理。
- 1900 前后历法边界：限定可计算范围。

Formulas (outline)

- 天干五行：甲乙木，丙丁火，戊己土，庚辛金，壬癸水。
- 十神相对关系：同我/异我、阴阳同性/异性判比劫、食伤、财、官杀、印。
- 纳音：60 甲子对应表。


