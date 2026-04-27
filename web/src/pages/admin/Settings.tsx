import { AdminPageShell } from '../../components/AdminPageShell'

export function AdminSettingsPage() {
  return (
    <AdminPageShell
      description="Admin settings should stay descriptive and operational rather than storing secrets in the client. Use backend configuration and environment controls for provider credentials."
      eyebrow="Admin platform settings"
      title="System operating rules"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 text-sm leading-7 text-slate-300 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          Clerk handles identity. Stripe handles billing. Mux handles streaming. The admin frontend should orchestrate those systems without exposing credentials.
        </div>
        <div className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 text-sm leading-7 text-slate-300 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          Future plan and device-limit logic should stay API-backed and database-driven so the admin dashboard remains a secure control layer rather than a second source of truth.
        </div>
      </div>
    </AdminPageShell>
  )
}
