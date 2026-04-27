import { AdminPageShell } from '../../components/AdminPageShell'

export function AdminExpansionPage() {
  return (
    <AdminPageShell
      description="Expansion administration should stay modular and content-led. Use this page to anchor future controls for Expansion-specific assets, entitlement rules, and rollout configuration."
      eyebrow="RAYD8® Expansion"
      title="Expansion control surface"
    >
      <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 text-sm leading-7 text-slate-300 backdrop-blur-xl">
        Expansion-specific tools can be added here without changing the global admin shell or billing infrastructure.
      </div>
    </AdminPageShell>
  )
}
