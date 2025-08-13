import { describe, it, expect } from 'vitest'
import { calculateBazi } from '../src/index'
import tz from 'moment-timezone'
import { Lunar, EightChar } from 'lunar-javascript'

function toLocalDate(iso: string, timezone: string) {
  return tz.tz(iso, timezone).toDate()
}

describe('calculateBazi', () => {
  it('matches lunar-javascript EightChar for pillars', () => {
    const datetime = '1988-08-08T08:08:00'
    const timezone = 'Asia/Shanghai'
    const date = toLocalDate(datetime, timezone)
    const lunar = Lunar.fromDate(date)
    const ec = EightChar.fromLunar(lunar)

    const r = calculateBazi({ datetime, timezone, gender: 'male' })

    const pairs = [
      `${r.year.heavenlyStem}${r.year.earthlyBranch}`,
      `${r.month.heavenlyStem}${r.month.earthlyBranch}`,
      `${r.day.heavenlyStem}${r.day.earthlyBranch}`,
      `${r.hour.heavenlyStem}${r.hour.earthlyBranch}`
    ]

    expect(pairs[0]).toBe(ec.getYear())
    expect(pairs[1]).toBe(ec.getMonth())
    expect(pairs[2]).toBe(ec.getDay())
    expect(pairs[3]).toBe(ec.getTime())

    // sanity (emptyBranches may be unavailable depending on library version)
    expect(Array.isArray(r.emptyBranches)).toBe(true)
    expect(Object.values(r.fiveElementPower).reduce((a,b)=>a+b,0)).toBeGreaterThan(0)
  })
})


