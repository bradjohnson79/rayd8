/**
 * Routed content inside `DashboardShell` (`presentation="immersive"`) renders into a
 * `<main>` that is pinned to `100dvh` with `overflow: hidden`.
 * Outlet pages must delegate vertical scrolling to their own subtree using this wrapper.
 *
 * Matches the member dashboard scroll surface (`Rayd8Dashboard`) for consistent behavior.
 */
export const immersiveDashboardOutletScrollClassName =
  'relative h-full min-h-0 overflow-y-auto overscroll-y-auto'
