import { useClerk } from '@clerk/react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../dashboard/useAuthUser'
import { MarketingButton } from './MarketingButton'

interface ConversionButtonProps {
  className?: string
  guestMode: 'signIn' | 'signUp'
  label: string
  to?: string
  variant?: 'ghost' | 'solid'
}

export function ConversionButton({
  className,
  guestMode,
  label,
  to,
  variant = 'solid',
}: ConversionButtonProps) {
  const { openSignIn, openSignUp } = useClerk()
  const navigate = useNavigate()
  const user = useAuthUser()

  return (
    <MarketingButton
      className={className}
      onClick={() => {
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
