import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './theme/ThemeProvider'
import { LanguageProvider } from './i18n/LanguageProvider'

// The Safari/iOS Bearer-token fallback that used to live here as an axios
// request interceptor now lives in src/apis/http.ts, so every request made
// through the shared fetch client gets it without a global side effect.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  </StrictMode>
)
