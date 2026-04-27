import { PlayerScreen } from '../features/player/PlayerScreen'
import { useAuthUser } from '../features/dashboard/useAuthUser'

export function PlayerPage() {
  const user = useAuthUser()

  return <PlayerScreen plan={user.plan} />
}
