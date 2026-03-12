import { useState, useEffect } from 'react'

export type Theme = 'dark' | 'light'

// Theme configurations
export const themes = {
  dark: {
    '--bg': '#080810',
    '--surface': '#0f0f1a',
    '--surface2': '#161624',
    '--border': '#1c1c30',
    '--border2': '#252540',
    '--accent': '#00ff9d',
    '--accent2': '#ff6b35',
    '--accent3': '#7c6aff',
    '--accent4': '#00d4ff',
    '--text': '#ddddf5',
    '--text2': '#8888aa',
    '--danger': '#ff4f6b',
  },
  light: {
    '--bg': '#ffffff',
    '--surface': '#f8f9fa',
    '--surface2': '#e9ecef',
    '--border': '#dee2e6',
    '--border2': '#adb5bd',
    '--accent': '#00b074',
    '--accent2': '#dc3545',
    '--accent3': '#6f42c1',
    '--accent4': '#0dcaf0',
    '--text': '#212529',
    '--text2': '#6c757d',
    '--danger': '#dc3545',
  },
} as const

// Apply theme to CSS custom properties
function applyTheme(theme: Theme) {
  const root = document.documentElement
  const themeVars = themes[theme]
  
  Object.entries(themeVars).forEach(([property, value]) => {
    root.style.setProperty(property, value)
  })
}

// Get stored theme or default to dark
function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('hc_theme')
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// Store theme preference
function setStoredTheme(theme: Theme) {
  try {
    localStorage.setItem('hc_theme', theme)
  } catch {
    // Ignore storage errors
  }
}

// Theme hook for React components
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    setStoredTheme(newTheme)
    applyTheme(newTheme)
  }

  const setThemeDirectly = (newTheme: Theme) => {
    setTheme(newTheme)
    setStoredTheme(newTheme)
    applyTheme(newTheme)
  }

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return {
    theme,
    toggleTheme,
    setTheme: setThemeDirectly,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  }
}

// Initialize theme on app load
export function initializeTheme() {
  const theme = getStoredTheme()
  applyTheme(theme)
  return theme
}