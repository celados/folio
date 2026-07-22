import { effect } from 'ripple'

export function Lifecycle(props: {
  label: string
  onCleanup: () => void
  onMount: () => void
}) @{
  effect(() => {
    props.onMount()
    return props.onCleanup
  })

  <p>{props.label}</p>
}
