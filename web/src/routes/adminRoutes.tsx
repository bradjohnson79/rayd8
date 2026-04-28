import { Suspense, lazy, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import { AppRouteErrorBoundary } from '../components/AppRouteErrorBoundary'
import { AdminRouteGuard } from './AdminRouteGuard'

const AdminLayout = lazy(() =>
  import('../components/AdminLayout').then((module) => ({ default: module.AdminLayout })),
)
const SessionAppShell = lazy(() =>
  import('../components/SessionAppShell').then((module) => ({
    default: module.SessionAppShell,
  })),
)
const AdminDashboardPage = lazy(() =>
  import('../pages/admin/Dashboard').then((module) => ({
    default: module.AdminDashboardPage,
  })),
)
const AdminInstructionsPage = lazy(() =>
  import('../pages/admin/Instructions').then((module) => ({
    default: module.AdminInstructionsPage,
  })),
)
const AdminExpansionPage = lazy(() =>
  import('../pages/admin/Expansion').then((module) => ({
    default: module.AdminExpansionPage,
  })),
)
const AdminPremiumPage = lazy(() =>
  import('../pages/admin/Premium').then((module) => ({ default: module.AdminPremiumPage })),
)
const AdminRegenPage = lazy(() =>
  import('../pages/admin/Regen').then((module) => ({ default: module.AdminRegenPage })),
)
const AdminSettingsPage = lazy(() =>
  import('../pages/admin/Settings').then((module) => ({
    default: module.AdminSettingsPage,
  })),
)
const PreviewDashboardPage = lazy(() =>
  import('../pages/admin/PreviewDashboard').then((module) => ({
    default: module.PreviewDashboardPage,
  })),
)
const AdminOrdersPage = lazy(() =>
  import('../pages/admin/admin-tools/Orders').then((module) => ({
    default: module.AdminOrdersPage,
  })),
)
const AdminSubscribersPage = lazy(() =>
  import('../pages/admin/admin-tools/Subscribers').then((module) => ({
    default: module.AdminSubscribersPage,
  })),
)
const AdminMuxPage = lazy(() =>
  import('../pages/admin/admin-tools/Mux').then((module) => ({ default: module.AdminMuxPage })),
)
const AdminMessagesPage = lazy(() =>
  import('../pages/admin/admin-tools/Messages').then((module) => ({
    default: module.AdminMessagesPage,
  })),
)
const AdminNotificationsPage = lazy(() =>
  import('../pages/admin/admin-tools/Notifications').then((module) => ({
    default: module.AdminNotificationsPage,
  })),
)
const AdminSettingsToolPage = lazy(() =>
  import('../pages/admin/admin-tools/AdminSettings').then((module) => ({
    default: module.AdminSettingsToolPage,
  })),
)

function RouteFallback() {
  return <div className="min-h-[40svh] rounded-[2rem] border border-white/10 bg-white/[0.03]" />
}

function lazyElement(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

export const adminRoutes: RouteObject = {
  path: '/admin',
  errorElement: <AppRouteErrorBoundary scope="admin" />,
  element: <AdminRouteGuard />,
  children: [
    {
      errorElement: <AppRouteErrorBoundary scope="admin" />,
      element: lazyElement(<SessionAppShell />),
      children: [
        {
          errorElement: <AppRouteErrorBoundary scope="admin" />,
          element: lazyElement(<AdminLayout />),
          children: [
            { index: true, element: lazyElement(<AdminDashboardPage />) },
            { path: 'preview/free', element: lazyElement(<PreviewDashboardPage plan="free-trial" />) },
            { path: 'preview/regen', element: lazyElement(<PreviewDashboardPage plan="regen" />) },
            { path: 'instructions', element: lazyElement(<AdminInstructionsPage />) },
            { path: 'expansion', element: lazyElement(<AdminExpansionPage />) },
            { path: 'premium', element: lazyElement(<AdminPremiumPage />) },
            { path: 'regen', element: lazyElement(<AdminRegenPage />) },
            { path: 'settings', element: lazyElement(<AdminSettingsPage />) },
            { path: 'orders', element: lazyElement(<AdminOrdersPage />) },
            { path: 'subscribers', element: lazyElement(<AdminSubscribersPage />) },
            { path: 'mux', element: lazyElement(<AdminMuxPage />) },
            { path: 'messages', element: lazyElement(<AdminMessagesPage />) },
            { path: 'notifications', element: lazyElement(<AdminNotificationsPage />) },
            { path: 'admin-settings', element: lazyElement(<AdminSettingsToolPage />) },
          ],
        },
      ],
    },
  ],
}
