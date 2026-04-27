import type { PropsWithChildren, ReactNode } from 'react'

interface AdminPageShellProps extends PropsWithChildren {
  eyebrow: string
  title: string
  description: string
  aside?: ReactNode
}

export function AdminPageShell({
  aside,
  children,
  description,
  eyebrow,
  title,
}: AdminPageShellProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-5 rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{title}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
        </div>

        {aside ? <div className="lg:max-w-[22rem]">{aside}</div> : null}
      </div>

      {children}
    </section>
  )
}
