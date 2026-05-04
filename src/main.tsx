import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/playfair-display/500.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/dm-serif-display/400.css'
import '@fontsource/dm-serif-display/400-italic.css'
import './index.css'
import App from './App.tsx'
import { applyInkwellMotionDataset, readInitialPlayAnimations } from './lib/motionPreference'

applyInkwellMotionDataset(readInitialPlayAnimations())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EditorErrorBoundary>
      <App />
    </EditorErrorBoundary>
  </StrictMode>,
)
