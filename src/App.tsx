import { Sidebar } from './Sidebar'
import { WorldMap } from './WorldMap'

function App() {
  return (
    <div className="flex h-svh w-full">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-hidden">
        <WorldMap />
      </main>
    </div>
  )
}

export default App
