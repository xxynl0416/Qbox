'use client'

import { useEffect, useState } from 'react'
import type { ThemeType } from '@/lib/types'

export default function ThemeSwitch() {
  const [theme, setTheme] = useState<ThemeType>('default')

  useEffect(() => {
    const saved = (localStorage.getItem('qbox-theme') || 'default') as ThemeType
    setTheme(saved)
    applyTheme(saved)
  }, [])

  function applyTheme(t: ThemeType) {
    document.documentElement.setAttribute('data-theme', t === 'default' ? '' : t)
    localStorage.setItem('qbox-theme', t)
  }

  function handleChange(t: ThemeType) {
    setTheme(t)
    applyTheme(t)
  }

  return (
    <div className="theme-switch">
      <button
        className={theme === 'default' ? 'active' : ''}
        onClick={() => handleChange('default')}
      >
        浅色
      </button>
      <button
        className={theme === 'mint' ? 'active' : ''}
        onClick={() => handleChange('mint')}
      >
        薄荷
      </button>
      <button
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => handleChange('dark')}
      >
        暗色
      </button>
    </div>
  )
}
