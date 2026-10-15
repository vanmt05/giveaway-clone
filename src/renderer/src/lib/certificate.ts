import i18n from '../i18n'
import type { EventDoc, Group } from './types'
import { subgroupTotals } from './event'

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const safeColor = (c: string): string => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#8a2091')
const safeImg = (u?: string): string => (u && /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : '')

function groupSection(g: Group, t: (k: string, o?: Record<string, unknown>) => string, color: string): string {
  const r = g.result
  if (!r) return `<section><h2>${esc(g.name)}</h2><p class="muted">${t('cert.notDrawn')}</p></section>`
  const s = r.settingsUsed
  const filter = s.subgroupFilter === 'all' ? t('cert.all') : s.subgroupFilter.join(', ')
  const quotas = s.quotaMode
    ? `<tr><th>${t('cert.quotas')}</th><td>${s.quotas.map((q) => `${esc(q.subgroup)}: ${q.winners}+${q.alternates}`).join(' · ')}</td></tr>`
    : ''
  const person = (e: { id: string; name: string; subgroup: string }): string =>
    `<td class="id">${esc(e.id)}</td><td>${esc(e.name)}</td><td>${esc(e.subgroup)}</td>`
  const head = `<tr><th>#</th><th>${t('cert.id')}</th><th>${t('cert.name')}</th><th>${t('cert.subgroup')}</th><th>${t('cert.prize')}</th></tr>`
  const winners = r.winners
    .map((w) => `<tr><td>${w.position}</td>${person(w)}<td>${esc(w.prize ?? '')}</td></tr>`)
    .join('')
  const alts = r.alternates.map((a, i) => `<tr><td>${i + 1}</td>${person(a)}<td></td></tr>`).join('')
  const repl = r.replacements.length
    ? `<h3>${t('cert.replacements')}</h3><table>${r.replacements
        .map(
          (x) =>
            `<tr><td>${esc(x.out.name)} (${esc(x.out.id)}) → ${esc(x.in.name)} (${esc(x.in.id)})</td><td>${t('cert.reason')}: ${esc(x.reason)}</td><td>${esc(x.at)}</td></tr>`
        )
        .join('')}</table>`
    : ''
  return `<section>
  <h2 style="border-color:${color}">${esc(g.name)}</h2>
  <table class="meta">
    <tr><th>${t('cert.date')}</th><td>${esc(new Date(r.drawnAt).toLocaleString(i18n.language))}</td></tr>
    <tr><th>${t('cert.participants')}</th><td>${r.participants}</td></tr>
    <tr><th>${t('cert.filter')}</th><td>${esc(filter)}</td></tr>${quotas}
    <tr><th>${t('cert.listHash')}</th><td class="mono">${esc(r.listHash)}</td></tr>
    <tr><th>${t('cert.seed')}</th><td class="mono">${esc(r.seed)}</td></tr>
    <tr><th>${t('cert.excludedCount')}</th><td>${r.excludedIds.length}</td></tr>
    <tr><th>${t('cert.excludedHash')}</th><td class="mono">${esc(r.excludedHash)}</td></tr>
  </table>
  <h3>${t('cert.winners')}</h3><table class="list">${head}${winners}</table>
  ${alts ? `<h3>${t('cert.alternates')}</h3><table class="list">${head}${alts}</table>` : ''}
  ${repl}
</section>`
}

/** Self-contained HTML (inline CSS, no scripts) used for PDF and PNG export. */
export function buildCertificateHtml(event: EventDoc): string {
  const t = (k: string, o?: Record<string, unknown>): string => i18n.t(k, o) as string
  const color = safeColor(event.branding.color)
  const logo = safeImg(event.branding.logoDataUrl)
  const totals = subgroupTotals(event).total
  const totalsTable = totals.length
    ? `<section><h2 style="border-color:${color}">${t('cert.summaryBySubgroup')}</h2><table class="list"><tr><th>${t('cert.subgroup')}</th><th>${t('cert.winners')}</th><th>${t('cert.alternates')}</th></tr>${totals
        .map((r) => `<tr><td>${esc(r.subgroup)}</td><td>${r.winners}</td><td>${r.alternates}</td></tr>`)
        .join('')}</table></section>`
    : ''
  return `<!doctype html><html lang="${i18n.language}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${esc(event.title)}</title>
<style>
*{box-sizing:border-box}body{font-family:Segoe UI,Arial,sans-serif;color:#1c1b22;margin:0;padding:32px;width:900px;background:#fff}
header{background:${color};color:#fff;padding:24px 28px;border-radius:12px;display:flex;align-items:center;gap:20px}
header img{max-height:56px;max-width:180px;background:#fff;border-radius:8px;padding:6px}
header h1{margin:0;font-size:26px}header p{margin:4px 0 0;opacity:.9}
section{margin-top:24px;page-break-inside:avoid}
h2{font-size:20px;border-bottom:3px solid ${color};padding-bottom:6px;margin:0 0 10px}h3{font-size:15px;margin:16px 0 6px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #e4e1ec;vertical-align:top}
table.meta th{width:34%;color:#5d5a6b;font-weight:600}table.list th{background:#f3f0f9}
.mono{font-family:Consolas,monospace;font-size:11px;word-break:break-all}.id{font-family:Consolas,monospace}.muted{color:#777}
footer{margin-top:28px;font-size:11px;color:#777;border-top:1px solid #e4e1ec;padding-top:10px}
</style></head><body>
<header>${logo ? `<img src="${logo}" alt="">` : ''}<div><h1>${t('cert.title')}</h1><p>${t('cert.event')}: ${esc(event.title)}</p></div></header>
${event.groups.map((g) => groupSection(g, t, color)).join('')}
${totalsTable}
<footer>${t('cert.footer', { v: __APP_VERSION__ })}</footer>
</body></html>`
}
