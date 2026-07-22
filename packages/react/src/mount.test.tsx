import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'ripple'
import { afterEach, describe, expect, it } from 'vite-plus/test'

// @ts-expect-error Ripple compiles .tsrx modules through its Vite plugin.
import { Lifecycle } from './test-fixtures/lifecycle.tsrx'
import { Mount } from './mount'

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

describe('Mount', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('owns one Ripple lifecycle for the lifetime of its DOM target', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    let mounts = 0
    let cleanups = 0
    const initialProps = {
      label: 'Mounted component',
      onCleanup: () => cleanups++,
      onMount: () => mounts++,
    }

    await act(async () => {
      root.render(<Mount component={Lifecycle} initialProps={initialProps} />)
    })
    await expect.poll(() => host.textContent).toBe('Mounted component')
    flushSync()

    expect(mounts).toBe(1)

    await act(async () => {
      root.render(<Mount component={Lifecycle} initialProps={initialProps} />)
    })
    flushSync()

    expect(mounts).toBe(1)

    await act(async () => {
      root.unmount()
    })

    expect(cleanups).toBe(1)
  })
})
