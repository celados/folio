import { afterEach, describe, expect, it } from 'vite-plus/test'
import { flushSync } from 'ripple'

// @ts-expect-error Ripple compiles .tsrx modules through its Vite plugin.
import { Failing } from './test-fixtures/failing.tsrx'
// @ts-expect-error Ripple compiles .tsrx modules through its Vite plugin.
import { Greeting } from './test-fixtures/greeting.tsrx'
// @ts-expect-error Ripple compiles .tsrx modules through its Vite plugin.
import { Pending } from './test-fixtures/pending.tsrx'
// @ts-expect-error Ripple compiles .tsrx modules through its Vite plugin.
import { WithCleanup } from './test-fixtures/with-cleanup.tsrx'
import { mount } from './mount'

describe('mount', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('renders a component into the target and disposes it', () => {
    const target = document.createElement('div')
    document.body.append(target)

    const dispose = mount({
      component: Greeting,
      initialProps: { name: 'Folio' },
      target,
    })

    expect(target.textContent).toBe('Hello, Folio!')

    dispose()

    expect(target.textContent).toBe('')
  })

  it('shows the shell error fallback when the component throws', () => {
    const target = document.createElement('div')

    mount({ component: Failing, initialProps: {}, target })

    expect(target.querySelector('[role="alert"]')?.textContent).toBe('Example component failed')
  })

  it('shows the shell pending fallback while the component loads', async () => {
    const target = document.createElement('div')
    let resolveValue!: (value: string) => void
    const value = new Promise<string>((resolve) => {
      resolveValue = resolve
    })

    mount({ component: Pending, initialProps: { value }, target })
    await new Promise((resolve) => setTimeout(resolve, 0))
    flushSync()

    expect(target.textContent).toBe('Loading component…')

    resolveValue('Loaded')
    await new Promise((resolve) => setTimeout(resolve, 0))
    flushSync()

    expect(target.textContent).toBe('Loaded')
  })

  it('shows the shell error fallback when a suspended component rejects', async () => {
    const target = document.createElement('div')
    let rejectValue!: (reason: Error) => void
    const value = new Promise<string>((_, reject) => {
      rejectValue = reject
    })

    mount({ component: Pending, initialProps: { value }, target })
    await new Promise((resolve) => setTimeout(resolve, 0))
    flushSync()

    rejectValue(new Error('Async component failed'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    flushSync()

    expect(target.querySelector('[role="alert"]')?.textContent).toBe('Async component failed')
  })

  it('runs component cleanup when disposed', () => {
    const target = document.createElement('div')
    let cleanups = 0
    const dispose = mount({
      component: WithCleanup,
      initialProps: { onCleanup: () => cleanups++ },
      target,
    })
    flushSync()

    dispose()

    expect(cleanups).toBe(1)
  })

  it('rejects a non-record props container without inspecting its fields', () => {
    const target = document.createElement('div')

    for (const initialProps of [[], new Date()]) {
      expect(() =>
        mount({
          component: Greeting,
          initialProps: initialProps as never,
          target,
        }),
      ).toThrow('@celados/folio initialProps must be a props record')
    }
  })
})
