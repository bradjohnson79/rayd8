const BRAND_NAME = 'RAYD8'
const DEFAULT_APP_URL = 'https://rayd8.app'

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

export function getRayd8Url(path = '/') {
  const normalizedBase = normalizeBaseUrl(process.env.APP_URL?.trim() || DEFAULT_APP_URL)

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function text(value: string | number | null | undefined, fallback: string) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  return String(value)
}

export function money(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== 'number') {
    return 'Unavailable'
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: text(currency?.toUpperCase(), 'USD'),
  })

  return formatter.format(amount)
}

export function renderParagraph(value: string) {
  return `<p style="margin:0 0 16px;color:#d7def3;font-size:15px;line-height:1.75;">${escapeHtml(value)}</p>`
}

export function renderInfoCard(title: string, body: string) {
  return `
    <div style="margin:0 0 18px;padding:20px;border:1px solid rgba(255,255,255,0.12);border-radius:22px;background:rgba(8,14,28,0.76);box-shadow:0 0 0 1px rgba(84,170,255,0.06) inset;">
      <h2 style="margin:0 0 12px;color:#ffffff;font-size:17px;line-height:1.4;">${escapeHtml(title)}</h2>
      ${body}
    </div>
  `
}

export function renderKeyValueTable(items: Array<{ label: string; value: string | null | undefined }>) {
  const rows = items
    .filter((item) => item.value !== undefined)
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8e9cc3;font-size:13px;font-weight:600;vertical-align:top;width:38%;">
          ${escapeHtml(item.label)}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#ffffff;font-size:14px;vertical-align:top;">
          ${escapeHtml(text(item.value, 'Unavailable'))}
        </td>
      </tr>
    `,
    )
    .join('')

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0;">
      ${rows}
    </table>
  `
}

interface EmailCallToAction {
  label: string
  url: string
  note?: string
}

interface Rayd8EmailOptions {
  eyebrow: string
  title: string
  intro: string
  sections: string[]
  callToAction?: EmailCallToAction
  footerNote?: string
}

function renderButton(action: EmailCallToAction) {
  const note = action.note
    ? `<p style="margin:12px 0 0;color:#8e9cc3;font-size:12px;line-height:1.6;">${escapeHtml(action.note)}</p>`
    : ''

  return `
    <div style="margin:28px 0 0;">
      <a
        href="${escapeHtml(action.url)}"
        style="display:inline-block;padding:13px 22px;border-radius:999px;border:1px solid rgba(151,217,255,0.7);background:linear-gradient(135deg,#74d7ff 0%,#7b8cff 52%,#b667ff 100%);color:#07111f;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 10px 30px rgba(116,215,255,0.28);"
      >
        ${escapeHtml(action.label)}
      </a>
      ${note}
    </div>
  `
}

export function renderRayd8Email(options: Rayd8EmailOptions) {
  const footerNote = options.footerNote
    ? `<p style="margin:14px 0 0;color:#8e9cc3;font-size:12px;line-height:1.7;">${escapeHtml(options.footerNote)}</p>`
    : ''

  return `
    <div style="margin:0;padding:32px 16px;background:radial-gradient(circle at top,#1d2c59 0%,#090d17 46%,#05070d 100%);">
      <div style="max-width:680px;margin:0 auto;border-radius:30px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:rgba(6,10,20,0.98);box-shadow:0 22px 70px rgba(0,0,0,0.45);">
        <div style="padding:34px 32px 28px;background:linear-gradient(135deg,rgba(28,42,82,0.98) 0%,rgba(21,29,56,0.98) 50%,rgba(63,20,94,0.94) 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="margin:0 0 14px;color:#9be4ff;font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">
            ${escapeHtml(options.eyebrow)}
          </div>
          <div style="margin:0;color:#ffffff;font-size:30px;font-weight:700;line-height:1.2;">
            ${escapeHtml(options.title)}
          </div>
          <p style="margin:14px 0 0;color:#d8e2ff;font-size:15px;line-height:1.75;">
            ${escapeHtml(options.intro)}
          </p>
        </div>

        <div style="padding:32px;">
          ${options.sections.join('')}
          ${options.callToAction ? renderButton(options.callToAction) : ''}
        </div>

        <div style="padding:24px 32px 32px;border-top:1px solid rgba(255,255,255,0.08);background:rgba(6,10,20,0.9);">
          <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;">${BRAND_NAME}</p>
          <p style="margin:8px 0 0;color:#8e9cc3;font-size:13px;line-height:1.7;">
            Streaming experiences, subscription access, and admin tools designed for the RAYD8 platform.
          </p>
          <p style="margin:16px 0 0;color:#8e9cc3;font-size:13px;line-height:1.7;">
            Visit <a href="${escapeHtml(getRayd8Url('/'))}" style="color:#ffffff;font-weight:700;text-decoration:none;">rayd8.app</a>
            &nbsp;for account access and support.
          </p>
          ${footerNote}
        </div>
      </div>
    </div>
  `
}
