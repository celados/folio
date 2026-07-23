export function Failing() @{
  throw new Error('Example component failed')
  <p>unreachable</p>
}
