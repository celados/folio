import { mount } from '@celados/folio'
import type { Component } from 'ripple'
import { Component as ReactComponent } from 'react'

export type MountProps<TProps extends object> = {
  component: Component<TProps>
  initialProps: TProps
}

class MountLifecycle<TProps extends object> extends ReactComponent<MountProps<TProps>> {
  private dispose: (() => void) | null = null
  private target: HTMLDivElement | null = null

  private captureTarget = (target: HTMLDivElement | null) => {
    this.target = target
  }

  componentDidMount() {
    if (this.target === null) {
      throw new Error('Mount target was not attached')
    }

    const { component, initialProps } = this.props
    this.dispose = mount({ component, initialProps, target: this.target })
  }

  componentWillUnmount() {
    this.dispose?.()
    this.dispose = null
  }

  render() {
    // A class lifecycle avoids coupling this linked adapter to the Host's hook dispatcher.
    return <div ref={this.captureTarget} style={{ display: 'contents' }} />
  }
}

export function Mount<TProps extends object>(props: MountProps<TProps>) {
  return <MountLifecycle {...props} />
}
