import { trackAsync } from 'ripple'

export function Pending(props: { value: Promise<string> }) @{
  let &[value] = trackAsync(() => props.value)
  <p>{value}</p>
}
