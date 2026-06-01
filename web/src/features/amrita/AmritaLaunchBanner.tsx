import { useNavigate } from 'react-router-dom'
import { trackUmamiEvent } from '../../services/umami'
import { isAmritaLaunchBannerActive } from './amritaContent'

interface AmritaLaunchBannerProps {
  className?: string
  location: string
}

export function AmritaLaunchBanner({ className = '', location }: AmritaLaunchBannerProps) {
  const navigate = useNavigate()

  if (!isAmritaLaunchBannerActive()) {
    return null
  }

  return (
    <section
      className={[
        'rounded-[1.6rem] border border-cyan-200/25 bg-[linear-gradient(135deg,rgba(8,145,178,0.28),rgba(88,28,135,0.2),rgba(5,7,12,0.74))] px-5 py-5 text-white shadow-[0_20px_70px_rgba(8,145,178,0.18)] backdrop-blur-2xl sm:px-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-cyan-100/80">
            NEW: RAYD8 AMRITA HAS ARRIVED
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-100 sm:text-base">
            Unlock Unlimited HAMSA and Unlimited AMRITA Access with the new flagship RAYD8 membership.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-full bg-cyan-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-950 shadow-[0_18px_48px_rgba(103,232,249,0.24)] transition hover:bg-cyan-100"
          onClick={() => {
            trackUmamiEvent('amrita_upgrade_clicked', {
              location,
              source: 'launch_banner',
            })
            navigate('/subscription?plan=amrita')
          }}
          type="button"
        >
          Start Amrita Membership
        </button>
      </div>
    </section>
  )
}
