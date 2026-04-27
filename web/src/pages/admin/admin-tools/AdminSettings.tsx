import { useEffect, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import { getAdminUsers, type AdminUserRecord } from '../../../services/admin'

export function AdminSettingsToolPage() {
  const getAuthToken = useAuthToken()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUserRecord[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for admin users.')
        }

        const response = await getAdminUsers(token)

        if (!cancelled) {
          setUsers(response.users)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : 'Unable to load admin user data.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  return (
    <AdminPageShell
      description="Use this page to review platform operators and user state without exposing provider credentials or bypassing backend authority."
      eyebrow="Admin tools"
      title="Admin settings"
    >
      {error ? (
        <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
            <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Plan</th>
                <th className="px-5 py-4">Devices</th>
                <th className="px-5 py-4">Active sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-slate-400" colSpan={5}>
                    Loading admin user data...
                  </td>
                </tr>
              ) : users.length ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-500">{user.id}</p>
                    </td>
                    <td className="px-5 py-4 capitalize">{user.role}</td>
                    <td className="px-5 py-4 capitalize">
                      {user.plan} • {user.subscription_status}
                    </td>
                    <td className="px-5 py-4">{user.device_count}</td>
                    <td className="px-5 py-4">{user.active_session_count}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-6 text-slate-400" colSpan={5}>
                    No user data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  )
}
