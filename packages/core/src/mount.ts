import * as Ripple from 'ripple'
import type { Component } from 'ripple'

// @ts-expect-error Ripple compiles .tsrx modules through its Vite plugin.
import { Shell } from './shell.tsrx'

export type InitialProps<TProps> = TProps extends object
  ? TProps extends readonly unknown[]
    ? never
    : TProps
  : never

type ComponentProps<TComponent extends Component<any>> = InitialProps<Parameters<TComponent>[0]>

export type MountOptions<TComponent extends Component<any>> = {
  component: TComponent
  initialProps: ComponentProps<TComponent>
  target: HTMLElement
}

export function mount<TComponent extends Component<any>>(options: MountOptions<TComponent>) {
  const { component, initialProps, target } = options

  if (import.meta.env.SSR) {
    throw new Error('@celados/folio mount() is unavailable during SSR')
  }
  if (!isPropsRecord(initialProps)) {
    throw new Error('@celados/folio initialProps must be a props record')
  }

  return Ripple.mount(Shell, {
    props: { component, initialProps },
    target,
  })
}

function isPropsRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value) as object | null
  return prototype === Object.prototype || prototype === null
}
