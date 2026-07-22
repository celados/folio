import { effect } from 'ripple'

export function WithCleanup(props: { onCleanup: () => void }) @{
  effect(() => props.onCleanup)
  <p>{'Mounted'}</p>
}
