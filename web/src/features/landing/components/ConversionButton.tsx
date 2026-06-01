import { useClerk } from '@clerk/react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../dashboard/useAuthUser'
import { MarketingButton } from './MarketingButton'

interface ConversionButtonProps {
  className?: string
  disabled?: boolean
  guestMode: 'signIn' | 'signUp'
  label: string
  onClick?: () => void
  to?: string
  variant?: 'ghost' | 'solid'
}

export function ConversionButton({
  className,
  disabled = false,
  guestMode,
  label,
  onClick,
  to,
  variant = 'solid',
}: ConversionButtonProps) {
  const { openSignIn, openSignUp } = useClerk()
  const navigate = useNavigate()
  const user = useAuthUser()

  return (
    <MarketingButton
      className={className}
      disabled={disabled}
      onClick={() => {
        if (onClick) {
          onClick()
          return
        }

        if (to) {
          navigate(to)
          return
        }

        if (user.isAuthenticated) {
          navigate('/dashboard')
          return
        }

        if (guestMode === 'signUp') {
          void openSignUp()
          return
        }

        void openSignIn()
      }}
      variant={variant}
    >
      {label}
    </MarketingButton>
  )
}
