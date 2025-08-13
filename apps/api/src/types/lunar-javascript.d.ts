declare module 'lunar-javascript' {
  export class Solar { static fromYmdHms(y:number,m:number,d:number,h:number,mi:number,s:number): Solar; getYear():number; getMonth():number; getDay():number; getHour():number; getMinute():number; getSecond():number }
  export class Lunar { static fromDate(date: Date): Lunar; getSolar(): Solar; getDate(): Date; getYear():number; getMonth():number; getDay():number; getMonthInChinese(): string; getDayInChinese(): string; getJieQi(): string; getXunKong(): string; getDaYun(isMale:boolean): any[]; getLiuNian(start:number,end:number): any[] }
  export class EightChar { static fromLunar(lunar: Lunar): EightChar; getYear(): string; getMonth(): string; getDay(): string; getTime(): string; getYearShiShen(): string; getMonthShiShen(): string; getTimeShiShen(): string }
}

