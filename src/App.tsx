import { DashboardClient } from './app/visualizador/Helper/visualpage'
import { Toaster } from 'sonner'
import './index.css'

function App() {
  // Empty initial models array, to be populated by user via upload
  return (
    <>
      <Toaster position="top-right" richColors />
      <DashboardClient modelos={[]} />
    </>
  )
}

export default App
