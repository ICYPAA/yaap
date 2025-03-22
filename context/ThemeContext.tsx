import React, { createContext, useContext, useEffect, useState } from "react"
import { useColorScheme } from "react-native"
import { darkThemeColors, theme as lightTheme } from "../constants/theme"

// Create a deep copy of the light theme and replace colors with dark theme colors
const darkTheme = {
  ...JSON.parse(JSON.stringify(lightTheme)),
  colors: darkThemeColors
}

type ThemeContextType = {
  theme: typeof lightTheme
  isDarkMode: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDarkMode: false,
  toggleTheme: () => {}
})

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const colorScheme = useColorScheme()
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === "dark")

  // Update theme when system theme changes
  useEffect(() => {
    setIsDarkMode(colorScheme === "dark")
  }, [colorScheme])

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev)
  }

  const value = {
    theme: isDarkMode ? darkTheme : lightTheme,
    isDarkMode,
    toggleTheme
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
