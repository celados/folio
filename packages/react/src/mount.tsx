import { mount } from '@folio/core'
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
    const target = targetRef.current

    if (target === null) {
      throw new Error('Mount target was not attached')
    }

    const { component, initialProps } = initialMount.current
    return mount({ component, initialProps, target })
  }, [])

  return <div ref={targetRef} />
}
