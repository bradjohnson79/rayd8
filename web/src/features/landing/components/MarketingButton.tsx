import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

interface MarketingButtonProps extends PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> {
  variant?: 'ghost' | 'solid'
}

export function MarketingButton({
  children,
  className = '',
  type = 'button',
  variant = 'solid',
  ...props
}: MarketingButtonProps) {
  const variantClasses =
    variant === 'ghost'
      ? 'border border-emerald-200/25 bg-black/15 text-white shadow-[0_0_0_1px_rgba(167,243,208,0.06)] hover:border-emerald-200/45 hover:bg-emerald-300/10 hover:shadow-[0_0_28px_rgba(16,185,129,0.22)]'
      : 'bg-[linear-gradient(135deg,rgba(16,185,129,0.95),rgba(59,130,246,0.92))] text-white shadow-[0_18px_55px_rgba(15,118,110,0.28)] hover:shadow-[0_22px_60px_rgba(59,130,246,0.24)]'

  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-medium transition duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 ${variantClasses} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}
