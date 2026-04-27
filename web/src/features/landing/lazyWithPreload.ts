import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

interface LazyWithPreload<T extends ComponentType<any>> extends LazyExoticComponent<T> {
  preload: () => Promise<{
    default: T
  }>
}

export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{
    default: T
  }>,
): LazyWithPreload<T> {
  const Component = lazy(factory) as LazyWithPreload<T>
  Component.preload = factory
  return Component
}
