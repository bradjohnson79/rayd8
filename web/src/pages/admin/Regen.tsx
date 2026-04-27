import { AdminPageShell } from '../../components/AdminPageShell'

export function AdminRegenPage() {
  return (
    <AdminPageShell
      description="REGEN administration should remain isolated, secure, and provider-backed. Use this page to host REGEN-specific content controls and future operational toggles."
      eyebrow="RAYD8® REGEN"
      title="REGEN administration"
    >
      <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 text-sm leading-7 text-slate-300 backdrop-blur-xl">
        REGEN can evolve independently here while keeping the same admin routing, auth, and API guardrails.
      </div>
    </AdminPageShell>
  )
}
