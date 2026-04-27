import { AdminPageShell } from '../../components/AdminPageShell'

export function AdminInstructionsPage() {
  return (
    <AdminPageShell
      description="Use this surface to manage platform operations without leaking provider access into the frontend. Keep all content, billing, and user orchestration API-driven."
      eyebrow="Admin instructions"
      title="Operate RAYD8® with clear boundaries"
    >
      <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 text-sm leading-7 text-slate-300 backdrop-blur-xl">
        <p>1. Use the dashboard home as the command center for current health.</p>
        <p>2. Review Orders and Subscribers before changing plan access or support status.</p>
        <p>3. Use the Mux panel to inspect assets and generate upload or playback artifacts through the backend only.</p>
        <p>4. Keep Clerk role metadata aligned with backend role enforcement at all times.</p>
      </div>
    </AdminPageShell>
  )
}
