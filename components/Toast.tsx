'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ToastContextType {
  toast: (msg: string, ms?: number) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)

  const toast = useCallback((msg: string, ms = 2000) => {
    setMessage(msg)
    setVisible(true)
    setTimeout(() => setVisible(false), ms)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className={`toast ${visible ? 'shown' : ''}`}>{message}</div>
    </ToastContext.Provider>
  )
}
