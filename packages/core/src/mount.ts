import * as Ripple from 'ripple'
import type { Component } from 'ripple'

// @ts-expect-error Ripple compiles .tsrx modules through its Vite plugin.
import { Shell } from './shell.tsrx'

type ComponentProps<TComponent extends Component<any>> = Parameters<TComponent>[0]

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

  return Ripple.mount(Shell, {
    props: { component, initialProps },
    target,
  })
}
