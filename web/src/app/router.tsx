import { Suspense, lazy, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { AppRouteErrorBoundary } from '../components/AppRouteErrorBoundary'
import { adminRoutes } from '../routes/adminRoutes'

const LandingPage = lazy(() =>
  import('../pages/LandingPage').then((module) => ({ default: module.LandingPage })),
)
const DashboardLayout = lazy(() =>
  import('../features/dashboard/DashboardLayout').then((module) => ({
    default: module.DashboardLayout,
  })),
)
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const InstructionsPage = lazy(() =>
  import('../features/dashboard/InstructionsPage').then((module) => ({
    default: module.InstructionsPage,
  })),
)
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const RegenUpgradePage = lazy(() =>
  import('../pages/RegenUpgradePage').then((module) => ({
    default: module.RegenUpgradePage,
  })),
)
const ContactPage = lazy(() =>
  import('../pages/ContactPage').then((module) => ({ default: module.ContactPage })),
)
const SubscriptionPage = lazy(() =>
  import('../pages/SubscriptionPage').then((module) => ({
    default: module.SubscriptionPage,
  })),
)
const SignupReferralPage = lazy(() =>
  import('../pages/SignupReferralPage').then((module) => ({
    default: module.SignupReferralPage,
  })),
)
const SuccessPage = lazy(() =>
  import('../pages/SuccessPage').then((module) => ({ default: module.SuccessPage })),
)
const Rayd8AffiliatePage = lazy(() =>
  import('../pages/Rayd8AffiliatePage').then((module) => ({
    default: module.Rayd8AffiliatePage,
  })),
)
const AffiliatePage = lazy(() =>
  import('../pages/AffiliatePage').then((module) => ({ default: module.AffiliatePage })),
)
const SessionAppShell = lazy(() =>
  import('../components/SessionAppShell').then((module) => ({
    default: module.SessionAppShell,
  })),
)

function RouteFallback() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_80%_24%,rgba(59,130,246,0.12),transparent_24%),linear-gradient(180deg,#04070a_0%,#070c10_100%)]" />
  )
}

function lazyElement(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        errorElement: <AppRouteErrorBoundary scope="public" />,
        element: lazyElement(<LandingPage />),
      },
      {
        path: 'subscription',
        errorElement: <AppRouteErrorBoundary scope="public" />,
        element: lazyElement(<SubscriptionPage />),
      },
      {
        path: 'signup',
        errorElement: <AppRouteErrorBoundary scope="public" />,
        element: lazyElement(<SignupReferralPage />),
      },
      {
        path: 'rayd8-affiliate',
        errorElement: <AppRouteErrorBoundary scope="public" />,
        element: lazyElement(<Rayd8AffiliatePage />),
      },
      {
        path: 'success',
        errorElement: <AppRouteErrorBoundary scope="public" />,
        element: lazyElement(<SuccessPage />),
      },
      {
        path: '/',
        errorElement: <AppRouteErrorBoundary scope="member" />,
        element: lazyElement(<SessionAppShell />),
        children: [
          {
            errorElement: <AppRouteErrorBoundary scope="member" />,
            element: lazyElement(<DashboardLayout />),
            children: [
              {
                errorElement: <AppRouteErrorBoundary scope="member" />,
                path: 'dashboard',
                element: <Outlet />,
                children: [
                  { index: true, element: lazyElement(<DashboardPage />) },
                  { path: 'affiliate', element: lazyElement(<AffiliatePage />) },
                  { path: 'instructions', element: lazyElement(<InstructionsPage />) },
                  { path: 'settings', element: lazyElement(<SettingsPage />) },
                  { path: 'upgrade', element: lazyElement(<RegenUpgradePage />) },
                ],
              },
              { path: 'player', element: <Navigate replace to="/dashboard" /> },
              { path: 'contact', element: lazyElement(<ContactPage />) },
              { path: 'instructions', element: <Navigate replace to="/dashboard/instructions" /> },
              { path: 'settings', element: <Navigate replace to="/dashboard/settings" /> },
            ],
          },
        ],
      },
      adminRoutes,
    ],
  },
])
