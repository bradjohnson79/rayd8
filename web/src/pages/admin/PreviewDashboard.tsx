import { Rayd8Dashboard } from '../../features/rayd8-dashboard/Rayd8Dashboard'

type PreviewDashboardPlan = 'free-trial' | 'regen'

interface PreviewDashboardPageProps {
  plan: PreviewDashboardPlan
}

export function PreviewDashboardPage({ plan }: PreviewDashboardPageProps) {
  return (
    <div className="min-h-screen overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/20">
      <Rayd8Dashboard forcedPlan={plan} />
    </div>
  )
}
