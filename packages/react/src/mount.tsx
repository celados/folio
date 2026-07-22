import type { Component } from 'ripple'
import { useEffect, useRef } from 'react'

export type MountProps<TProps extends object> = {
  component: Component<TProps>
  initialProps: TProps
}

export function Mount<TProps extends object>(props: MountProps<TProps>) {
  const targetRef = useRef<HTMLDivElement>(null)
  // Host rerenders cannot mutate a live Ripple tree; a React key starts a new lifecycle.
  const initialMount = useRef(props)

  useEffect(() => {
    if (import.meta.env.SSR) {
      return
    }

    const target = targetRef.current

    if (target === null) {
      throw new Error('Mount target was not attached')
    }

    const { component, initialProps } = initialMount.current
    let dispose: (() => void) | undefined
    let isActive = true

    // SSR must not pull Ripple's DOM-only mount export into the server module graph.
    void import('@folio/core').then(({ mount }) => {
      if (isActive) {
        dispose = mount({ component, initialProps, target })
      }
    })

    return () => {
      isActive = false
      dispose?.()
    }
  }, [])

  return <div ref={targetRef} />
}
