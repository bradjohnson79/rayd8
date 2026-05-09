import type { ReactNode } from 'react'
import { Rayd8Background } from '../../components/Rayd8Background'
import { LandingFooter } from '../landing/LandingFooter'
import { LandingNavbar } from '../landing/LandingNavbar'

type LegalPageShellProps = {
  children: ReactNode
}

export function LegalPageShell({ children }: LegalPageShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#04070a] text-slate-100">
      <Rayd8Background />
      <LandingNavbar />
      <main className="relative z-10 flex-1">{children}</main>
      <div className="relative z-10 mt-auto">
        <LandingFooter />
      </div>
    </div>
  )
}
