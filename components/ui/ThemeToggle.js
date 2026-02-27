'use client'

import { useTheme } from '../ThemeProvider'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-cortex-surface-raised border border-cortex-border hover:border-cortex-border-strong transition-colors"
      aria-label="Toggle theme"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-cortex-warning" />
      ) : (
        <Moon className="w-4 h-4 text-cortex-accent" />
      )}
    </button>
  )
}