import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { Experience } from '../../app/types'
import { AdminPageShell } from '../../components/AdminPageShell'
import {
  ADMIN_GLOBAL_PLAYERS,
  getAdminGlobalPlayer,
  type AdminGlobalPlayer,
} from '../../features/admin/adminGlobalPlayers'
import { Rayd8Dashboard } from '../../features/rayd8-dashboard/Rayd8Dashboard'
import { trackUmamiEvent } from '../../services/umami'

const IFRAME_PLAYER_URLS: Partial<Record<AdminGlobalPlayer['id'], string>> = {}

const toneClasses: Record<AdminGlobalPlayer['tone'], string> = {
  cyan: 'border-cyan-200/15 bg-cyan-300/[0.04] text-cyan-100',
  emerald: 'border-emerald-200/15 bg-emerald-300/[0.04] text-emerald-100',
  violet: 'border-violet-200/15 bg-violet-300/[0.04] text-violet-100',
}

function AdminAccessBadge() {
  return (
    <span className="inline-flex rounded-full border border-emerald-200/20 bg-emerald-300/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.26em] text-emerald-100/80">
      Admin Access
    </span>
  )
}

export function AdminGlobalPlayersPage() {
  return (
    <AdminPageShell
      aside={<AdminAccessBadge />}
      description="Open every RAYD8 global player and environment with role-based unrestricted internal access for QA, validation, content review, and operational oversight."
      eyebrow="Global Players"
      title="Admin player access"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {ADMIN_GLOBAL_PLAYERS.map((player) => (
          <Link
            className={[
              'group rounded-[1.75rem] border p-5 shadow-[0_20px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition duration-300',
              'hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07]',
              toneClasses[player.tone],
            ].join(' ')}
            key={player.id}
            to={player.route}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">
                  {player.kind === 'rayd8' ? 'RAYD8 Player' : 'Environment'}
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">{player.label}</h2>
              </div>
              <AdminAccessBadge />
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{player.description}</p>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-white/55 transition group-hover:text-white">
              Quick launch
            </p>
          </Link>
        ))}
      </div>

      <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-300 backdrop-blur-xl">
        Future Admin Playback Tools can live beside this hub later: reset sessions, reset hours,
        simulate tiers, and test entitlement failures without changing the global player routes.
      </div>
    </AdminPageShell>
  )
}

export function AdminGlobalPlayerDetailPage() {
  const { playerId } = useParams()
  const player = getAdminGlobalPlayer(playerId)

  useEffect(() => {
    if (!player) return
    trackUmamiEvent('admin_player_opened', {
      adminAccess: player.adminAccess,
      player: player.id,
      playerKind: player.kind,
    })
  }, [player])

  if (!player) {
    return <Navigate replace to="/admin/global-players" />
  }

  if (player.kind === 'rayd8') {
    return (
      <div className="space-y-4">
        <AdminPageShell
          aside={<AdminAccessBadge />}
          description={`${player.label} is running in admin unrestricted mode for internal QA and operational review.`}
          eyebrow="Global Players"
          title={player.label}
        />
        <div className="min-h-screen overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/20">
          <Rayd8Dashboard
            adminAccessMode
            adminExperience={player.id as Experience}
            adminModeLabel="Admin Access"
          />
        </div>
      </div>
    )
  }

  const url = IFRAME_PLAYER_URLS[player.id] ?? '/'

  return (
    <AdminPageShell
      aside={<AdminAccessBadge />}
      description={`${player.label} is available here with admin unrestricted access for internal QA and content review.`}
      eyebrow="Global Players"
      title={player.label}
    >
      <div className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/40 shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-3 border-b border-white/10 bg-black/35 px-5 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-violet-100/55">
              Unlimited internal environment
            </p>
            <p className="mt-1 text-sm text-slate-300">{player.description}</p>
          </div>
          <AdminAccessBadge />
        </div>
        <iframe
          allow="autoplay; fullscreen; clipboard-read; clipboard-write; screen-wake-lock"
          className="block min-h-[42rem] w-full border-0 bg-black"
          src={url}
          title={`${player.label} admin player`}
        />
      </div>
    </AdminPageShell>
  )
}
