import { NavLink, useLocation, useNavigate } from 'react-router-dom'

interface AdminSidebarProps {
  onClose: () => void
  open: boolean
}

const mainPlatformItems = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Instructions', to: '/admin/instructions' },
  { label: 'RAYD8® Expansion', to: '/admin/expansion' },
  { label: 'RAYD8® Premium', to: '/admin/premium' },
  { label: 'RAYD8® REGEN', to: '/admin/regen' },
  { label: 'Settings', to: '/admin/settings' },
]

const adminItems = [
  { label: 'Orders', to: '/admin/orders' },
  { label: 'Subscribers', to: '/admin/subscribers' },
  { label: 'Mux', to: '/admin/mux' },
  { label: 'Messages', to: '/admin/messages' },
  { label: 'Notifications', to: '/admin/notifications' },
  { label: 'Admin Settings', to: '/admin/admin-settings' },
]

const contactItems = [{ label: 'Contact Admin', to: '/contact' }]

function SidebarSection({
  items,
  label,
  onClose,
}: {
  items: Array<{ label: string; to: string }>
  label: string
  onClose: () => void
}) {
  return (
    <div className="space-y-2">
      <p className="px-4 text-xs uppercase tracking-[0.32em] text-violet-200/55">{label}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              className={({ isActive }) =>
                [
                  'flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-violet-300/15 text-white shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl'
                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white hover:backdrop-blur-xl',
                ].join(' ')
              }
              onClick={onClose}
              to={item.to}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

const previewItems = [
  { disabled: false, label: 'Admin Dashboard', to: '/admin' },
  { disabled: false, label: 'Free Trial Preview', to: '/admin/preview/free' },
  { disabled: false, label: 'REGEN Preview', to: '/admin/preview/regen' },
  { disabled: true, label: 'AMRITA', to: null },
]

function PreviewRouteSection({ onClose }: { onClose: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.32em] text-violet-200/55">Preview dashboards</p>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Route Preview</p>
      <div className="flex flex-col gap-2">
        {previewItems.map((item) => (
          <button
            className={[
              'rounded-2xl px-4 py-2.5 text-left text-xs font-medium uppercase tracking-[0.24em] transition-all duration-300',
              item.disabled
                ? 'cursor-not-allowed bg-white/6 text-white/40 opacity-40'
                : item.to === location.pathname
                  ? 'bg-violet-500 text-white shadow-[0_10px_30px_rgba(0,0,0,0.14)]'
                : 'bg-white/10 text-white/70 hover:bg-white/16 hover:text-white',
            ].join(' ')}
            key={item.label}
            onClick={() => {
              if (item.disabled || !item.to) {
                return
              }

              navigate(item.to)
              onClose()
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AdminSidebar({ onClose, open }: AdminSidebarProps) {
  return (
    <>
      {open ? (
        <button
          aria-label="Close admin navigation"
          className="fixed inset-0 z-30 bg-black/50 xl:hidden"
          onClick={onClose}
          type="button"
        />
      ) : null}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10',
          'bg-[rgba(4,6,10,0.58)] shadow-[0_18px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
          'xl:translate-x-0',
        ].join(' ')}
      >
        <div className="border-b border-white/10 px-5 py-6">
          <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">RAYD8® Amrita</p>
          <h1 className="mt-3 text-xl font-semibold text-white">Admin Operating Layer</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Secure control surface for content, subscriptions, users, and streaming.
          </p>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          <PreviewRouteSection onClose={onClose} />
          <SidebarSection items={mainPlatformItems} label="Main Platform" onClose={onClose} />
          <SidebarSection items={contactItems} label="Contact" onClose={onClose} />
          <SidebarSection items={adminItems} label="Admin Section" onClose={onClose} />
        </nav>
      </aside>
    </>
  )
}
