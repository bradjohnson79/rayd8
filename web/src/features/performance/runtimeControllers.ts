export interface AdaptiveRuntimeController {
  setRenderFPS: (fps: number) => void
  setRenderScale: (scale: number) => void
  pauseRendering: () => void
  resumeRendering: () => void
  dispose: () => void
  status: () => Record<string, unknown>
}

type ControllerKey = 'hamsa' | 'amrita' | 'express'

const controllers = new Map<ControllerKey, AdaptiveRuntimeController>()

export function registerRuntimeController(
  key: ControllerKey,
  controller: AdaptiveRuntimeController,
) {
  controllers.set(key, controller)
}

export function unregisterRuntimeController(key: ControllerKey) {
  controllers.delete(key)
}

export function getRuntimeController(key: ControllerKey) {
  return controllers.get(key) ?? null
}

export function listRuntimeControllers() {
  return Array.from(controllers.entries()).map(([key, controller]) => ({
    key,
    status: controller.status(),
  }))
}

export function applyReducedVisualPerformance() {
  for (const controller of controllers.values()) {
    controller.setRenderFPS(20)
    controller.setRenderScale(0.75)
  }
}

export function applyStandardVisualPerformance() {
  for (const controller of controllers.values()) {
    controller.setRenderFPS(30)
    controller.setRenderScale(1)
  }
}
