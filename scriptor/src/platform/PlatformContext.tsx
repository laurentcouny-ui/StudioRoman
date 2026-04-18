/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react'
import type { PlatformAPI } from './types'
import { platform } from './index'

const PlatformContext = createContext<PlatformAPI | null>(null)

export function PlatformProvider({ children }: { children: ReactNode }) {
  return (
    <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>
  )
}

export function usePlatform(): PlatformAPI {
  const ctx = useContext(PlatformContext)
  if (!ctx) {
    throw new Error('usePlatform doit être utilisé sous <PlatformProvider>.')
  }
  return ctx
}
