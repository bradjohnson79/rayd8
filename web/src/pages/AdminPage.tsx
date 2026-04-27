interface AdminPageProps {
  title: string
  description: string
}

export function AdminPage({ title, description }: AdminPageProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/20 p-6 backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Admin</p>
      <h2 className="mt-3 text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
    </section>
  )
}
