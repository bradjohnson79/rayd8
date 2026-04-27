interface AdminStatCardProps {
  label: string
  value: string | number
  detail: string
}

export function AdminStatCard({ detail, label, value }: AdminStatCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/12 bg-white/[0.055] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </article>
  )
}
