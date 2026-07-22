import { createFileRoute } from '@tanstack/react-router'
import { Mount } from '@folio/react'

// @ts-expect-error Ripple compiles .tsrx modules through its Vite plugin.
import { MobilityReport } from '@/components/mobility-report.tsrx'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const data = [
    { change: 18, city: 'Lisbon', trips: 18420 },
    { change: 13, city: 'Berlin', trips: 15760 },
    { change: 29, city: 'Taipei', trips: 14210 },
    { change: 9, city: 'Oslo', trips: 9870 },
    { change: 22, city: 'Seoul', trips: 12640 },
  ]

  return (
    <main className="min-h-svh bg-[#edf1ed] p-4 sm:p-8 lg:p-14">
      <Mount
        component={MobilityReport}
        initialProps={{ data, period: 'January — June 2026', title: 'Urban mobility pulse' }}
      />
    </main>
  )
}
