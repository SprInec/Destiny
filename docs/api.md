API Spec

POST /api/bazi

Request

{
  "datetime": "2024-08-01T10:30:00",
  "timezone": "Asia/Shanghai",
  "calendar": "gregorian",
  "gender": "male",
  "location": { "lat": 31.2, "lon": 121.5 }
}

Response

{
  "input": { "normalizedISO": "..." },
  "year": { "heavenlyStem": "甲", "earthlyBranch": "子", "hiddenStems": ["癸"], "naYin": "海中金" },
  "month": { ... },
  "day": { ... },
  "hour": { ... },
  "emptyBranches": ["辰","巳"],
  "fiveElementPower": { "wood":1, "fire":1, "earth":1, "metal":0, "water":1 },
  "tenGods": { "year":"偏印", "month":"...", "day":"日主", "hour":"..." },
  "luckCycles": { "daYun":[{"startAge":8,"startYear":2032,"pillar":"庚子"}], "liuNian":[{"year":2032,"pillar":"壬辰"}] }
}

POST /api/convert

Request

{ "datetime":"2024-08-01T10:30:00", "timezone":"Asia/Shanghai", "to":"lunar" }

Response (to=lunar)

{ "lunar": { "ymd":"2024-6-26", "monthName":"六月", "dayName":"廿六", "jieQi":"大暑" } }

Response (to=gregorian)

{ "solar": { "ymd":"2024-08-01", "hms":"10:30:00" } }

Errors

- 400 with { error }


