import { Link } from 'react-router-dom'

const SOCIAL = {
  facebook: 'https://www.facebook.com',
  youtube: 'https://www.youtube.com',
} as const

const disclaimer =
  'RAYD8® is not a medical device and is not intended to diagnose, treat, cure, or prevent any disease. It is an experimental visual resonance technology designed for personal exploration and wellness support.'

const footerLinkClassName =
  'text-sm text-white/78 transition-colors duration-200 hover:text-white sm:text-[15px] sm:leading-snug'

function FacebookIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5 shrink-0 text-slate-900"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5 shrink-0 text-slate-900"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export function LandingFooter() {
  return (
    <footer className="px-4 pb-10 pt-6 text-sm sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-[rgba(6,10,14,0.56)] px-6 py-6 text-slate-300 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:rounded-[2.25rem] sm:px-8 sm:py-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <nav aria-label="Footer" className="flex flex-col gap-4 sm:flex-1 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
            <Link className={footerLinkClassName} to="/#about">
              About
            </Link>
            <Link className={footerLinkClassName} to="/#contact">
              Contact
            </Link>
            <Link className={footerLinkClassName} to="/privacy">
              Privacy Policy
            </Link>
            <Link className={footerLinkClassName} to="/terms">
              Terms and Conditions
            </Link>
          </nav>

          <div className="flex items-center gap-3 sm:shrink-0">
            <a
              aria-label="Facebook"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.92] text-slate-900 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200/50"
              href={SOCIAL.facebook}
              rel="noreferrer"
              target="_blank"
            >
              <FacebookIcon />
            </a>
            <a
              aria-label="YouTube"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.92] text-slate-900 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200/50"
              href={SOCIAL.youtube}
              rel="noreferrer"
              target="_blank"
            >
              <YouTubeIcon />
            </a>
          </div>
        </div>

        <div className="mt-4 max-w-5xl border-t border-white/8 pt-4 sm:mt-5 sm:pt-5">
          <p className="text-xs leading-6 text-white/56">{disclaimer}</p>
          <p className="mt-3 text-xs text-white/50">Copyright 2026 - AetherX Inc - RAYD8</p>
        </div>
      </div>
    </footer>
  )
}
