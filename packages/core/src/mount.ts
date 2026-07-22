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
  // Ripple intentionally omits mount from its server export; defer lookup so Host SSR can import us.
  const mountRipple = Reflect.get(Ripple, 'mount') as typeof Ripple.mount | undefined

  if (mountRipple === undefined) {
    throw new Error("@folio/core mount() requires Ripple's browser runtime")
  }

  return mountRipple(Shell, {
    props: { component, initialProps },
    target,
  })
}
