import Papa from 'papaparse'

const DELIMS = ['\t', ';', ',']

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10)
  let best = ','
  let bestScore = 0
  for (const d of DELIMS) {
    const counts = sample.map((l) => l.split(d).length - 1)
    const min = Math.min(...counts)
    if (counts.length && min > bestScore) {
      best = d
      bestScore = min
    }
  }
  return best
}

/** Parse pasted / .csv / .txt content into a table of trimmed string cells. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const res = Papa.parse<string[]>(clean, {
    delimiter: detectDelimiter(clean),
    skipEmptyLines: 'greedy'
  })
  return res.data.map((r) => r.map((c) => String(c ?? '').trim()))
}
