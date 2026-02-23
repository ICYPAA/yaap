import React, { createContext, useContext, useEffect, useState } from "react"
import { useColorScheme } from "react-native"
import { darkThemeColors, theme as lightTheme } from "../constants/theme"
import { getThemeMode, setThemeMode } from "../lib/storage"
import { getProgramDesign } from "../lib/theme"
import { ConferenceDesign } from "../types/program"

// Create a deep copy of the light theme and replace colors with dark theme colors
const darkTheme = {
  ...JSON.parse(JSON.stringify(lightTheme)),
  colors: darkThemeColors
}

type ThemeContextType = {
  theme: typeof lightTheme
  isDarkMode: boolean
  toggleTheme: () => void
  programDesign: ConferenceDesign | null
}

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDarkMode: false,
  toggleTheme: () => {},
  programDesign: null
})

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const colorScheme = useColorScheme()
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === "dark")
  const [isLoaded, setIsLoaded] = useState(false)
  const [programDesign, setProgramDesign] = useState<ConferenceDesign | null>(
    null
  )
  const [currentTheme, setCurrentTheme] = useState(
    isDarkMode ? darkTheme : lightTheme
  )

  // Load program design from storage
  useEffect(() => {
    const loadProgramDesign = async () => {
      try {
        const design = await getProgramDesign()
        if (design) {
          setProgramDesign(design)

          // Apply program design colors to theme
          const baseTheme = isDarkMode ? darkTheme : lightTheme
          const updatedTheme = {
            ...baseTheme,
            colors: {
              ...baseTheme.colors,
              // Only override primary and secondary if they exist in program design
              ...(design.colors?.primary && { primary: design.colors.primary }),
              ...(design.colors?.secondary && {
                secondary: design.colors.secondary
              })
            }
          }
          setCurrentTheme(updatedTheme)
        }
      } catch (error) {
        console.error("Error loading program design:", error)
      }
    }

    loadProgramDesign()
  }, [isDarkMode])

  // Load saved theme on mount
  useEffect(() => {
    const loadSavedTheme = async () => {
      const savedTheme = await getThemeMode()
      if (savedTheme) {
        setIsDarkMode(savedTheme === "dark")
      } else {
        // If no saved theme, use system default
        setIsDarkMode(colorScheme === "dark")
      }
      setIsLoaded(true)
    }

    loadSavedTheme()
  }, [])

  // Update theme when system theme changes, but only if no saved preference
  useEffect(() => {
    const checkSavedTheme = async () => {
      const savedTheme = await getThemeMode()
      if (!savedTheme) {
        setIsDarkMode(colorScheme === "dark")
      }
    }

    if (isLoaded) {
      checkSavedTheme()
    }
  }, [colorScheme, isLoaded])

  const toggleTheme = async () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    await setThemeMode(newMode ? "dark" : "light")
  }

  const value = {
    theme: currentTheme,
    isDarkMode,
    toggleTheme,
    programDesign
  }

  if (!isLoaded) {
    return null // Or return a loading component
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
