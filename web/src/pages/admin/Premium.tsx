import { AdminPageShell } from '../../components/AdminPageShell'

export function AdminPremiumPage() {
  return (
    <AdminPageShell
      description="Premium operations should stay tied to subscription state and secure playback policy. Use this page for Premium-specific content and rollout controls."
      eyebrow="RAYD8® Premium"
      title="Premium administration"
    >
      <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 text-sm leading-7 text-slate-300 backdrop-blur-xl">
        Premium content, access rules, and future segmentation controls can live here without bypassing Stripe or Clerk enforcement.
      </div>
    </AdminPageShell>
  )
}
