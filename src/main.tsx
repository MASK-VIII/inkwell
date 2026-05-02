import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EditorErrorBoundary>
      <App />
    </EditorErrorBoundary>
  </StrictMode>,
)
