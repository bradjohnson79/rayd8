interface CloseButtonProps {
  onClick: () => void
}

export function CloseButton({ onClick }: CloseButtonProps) {
  return (
    <button
      aria-label="Close player"
      className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-black/30 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:bg-black/50"
      onClick={onClick}
      type="button"
    >
      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
        <path d="m7 7 10 10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    </button>
  )
}
