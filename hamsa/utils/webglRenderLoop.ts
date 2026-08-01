/**
 * Shared WebGL rAF gating for Hamsa web surfaces.
 * Idle / paused / hidden tabs must not sustain full-rate GPU redraw.
 * WebGL contexts must not be created until first START (lazy init).
 */

import { getHamsaTargetFps, isHamsaRenderingPaused } from "./hamsaPerfProbe"

export const HAMSA_WEBGL_TARGET_FPS = 30

export function getHamsaFrameMs() {
  const fps = getHamsaTargetFps() || HAMSA_WEBGL_TARGET_FPS
  return 1000 / fps
}

/** @deprecated use getHamsaFrameMs() — kept for static regression scans */
export const HAMSA_WEBGL_FRAME_MS = 1000 / HAMSA_WEBGL_TARGET_FPS

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function isDocumentVisible(): boolean {
  if (typeof document === "undefined") {
    return true
  }
  return document.visibilityState === "visible"
}

export function shouldRunHamsaWebglLoop(isPlaying: boolean): boolean {
  return (
    Boolean(isPlaying) &&
    isDocumentVisible() &&
    !prefersReducedMotion() &&
    !isHamsaRenderingPaused()
  )
}
