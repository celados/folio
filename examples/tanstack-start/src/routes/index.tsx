import { createFileRoute } from '@tanstack/react-router'
import { Mount } from '@celados/folio-react'
import { WorldDevelopmentReport } from '@celados/folio-example-world-development'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <main className="min-h-svh bg-[#eef2ee] p-4 sm:p-8 lg:p-12">
      <Mount
        component={WorldDevelopmentReport}
        initialProps={{
          subtitle:
            'Explore 180 nations across 209 years through linked views rebuilt from official Observable and D3 notebooks.',
          title: 'World development atlas',
        }}
      />
    </main>
  )
}
