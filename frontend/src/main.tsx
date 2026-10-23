import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { queryClient } from './lib/query-client'
import { AuthProvider } from './lib/auth-context'
import { LangProvider } from './lib/i18n'
import { VoiceProvider } from './lib/voice-settings'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LangProvider>
          <VoiceProvider>
            <App />
          </VoiceProvider>
        </LangProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
