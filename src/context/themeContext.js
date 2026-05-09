import { createContext } from 'react'

export const ThemeContext = createContext({
  themeMode: 'system',
  resolvedTheme: 'light',
  setThemeMode: () => {},
})
