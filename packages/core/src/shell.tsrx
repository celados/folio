import type { Component } from 'ripple'

export type ShellProps = {
  component: Component<any>
  initialProps: Record<string, unknown>
}

export function Shell(props: ShellProps) @{
  const { component, initialProps } = props

  @try {
    <{component} {...initialProps} />
  } @pending {
    <div aria-live="polite">{'Loading component…'}</div>
  } @catch (error) {
    <div role="alert">
      {error instanceof Error ? error.message : 'Component failed to render.'}
    </div>
  }
}
