import AsyncStorage from "@react-native-async-storage/async-storage"
import { ConferenceDesign, Program } from "../types/program"

// Helper function to determine text color based on background color contrast
export const getTextColorForBackground = (backgroundColor: string): string => {
  // Convert hex to RGB
  const hexToRgb = (hex: string): number[] => {
    const sanitizedHex = hex.replace("#", "")
    if (sanitizedHex.length === 3) {
      return [
        parseInt(sanitizedHex[0] + sanitizedHex[0], 16),
        parseInt(sanitizedHex[1] + sanitizedHex[1], 16),
        parseInt(sanitizedHex[2] + sanitizedHex[2], 16)
      ]
    }
    if (sanitizedHex.length === 6) {
      return [
        parseInt(sanitizedHex.substring(0, 2), 16),
        parseInt(sanitizedHex.substring(2, 4), 16),
        parseInt(sanitizedHex.substring(4, 6), 16)
      ]
    }
    return [255, 255, 255] // Default to white if invalid hex
  }

  // Calculate luminance of the color
  const calculateLuminance = (rgb: number[]): number => {
    const [r, g, b] = rgb.map((val) => {
      val = val / 255
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  try {
    const rgb = hexToRgb(backgroundColor)
    const luminance = calculateLuminance(rgb)

    // WCAG recommends 4.5:1 contrast for normal text, but we'll use a simpler threshold
    return luminance > 0.5 ? "#000000" : "#ffffff"
  } catch (error) {
    // If error in calculation, return white for dark backgrounds, black for light
    return backgroundColor && backgroundColor.toLowerCase() !== "#ffffff"
      ? "#ffffff"
      : "#000000"
  }
}

// Helper to extract theme colors
export const getThemeColor = (colorKey: string, theme: any): string => {
  // Handle nested properties like 'text.primary'
  if (colorKey.includes(".")) {
    const [category, specific] = colorKey.split(".")
    if (category === "text" && theme.colors.text) {
      return theme.colors.text[specific] || theme.colors.text.primary
    }
  }

  // Return direct color if it exists
  return theme.colors[colorKey] || theme.colors.primary
}

// Helper function to get program colors
export const getProgramColor = (
  programDetails: Program | null,
  colorKey: string,
  theme: any
): string => {
  // If no program details, fall back to theme
  if (!programDetails || !programDetails.design) {
    return getThemeColor(colorKey, theme)
  }

  const design = programDetails.design

  // Handle nested properties like 'text.primary'
  if (colorKey.includes(".")) {
    const [category, specific] = colorKey.split(".")
    if (category === "text") {
      // For text colors, fall back to theme
      return theme.colors.text[specific] || theme.colors.text.primary
    }
    // No nested color found in design, fall back to theme
    return getThemeColor(colorKey, theme)
  }

  // Map from theme color names to design colors
  switch (colorKey) {
    case "primary":
      return design.colors?.primary || theme.colors.primary
    case "secondary":
      return design.colors?.secondary || theme.colors.secondary
    case "background":
      return theme.colors.background // No background in design, use theme
    case "surface":
      return theme.colors.surface // No surface in design, use theme
    case "text":
      return theme.colors.text.primary
    default:
      return getThemeColor(colorKey, theme)
  }
}

// Store program design in AsyncStorage
export const storeProgramDesign = async (program: Program): Promise<void> => {
  try {
    await AsyncStorage.setItem("current_program", JSON.stringify(program))

    // Store design separately for quicker access
    if (program.design) {
      await AsyncStorage.setItem(
        "program_design",
        JSON.stringify(program.design)
      )
    }
  } catch (error) {
    console.error("Error storing program design:", error)
  }
}

// Get stored program design
export const getProgramDesign = async (): Promise<ConferenceDesign | null> => {
  try {
    const designJson = await AsyncStorage.getItem("program_design")
    if (designJson) {
      return JSON.parse(designJson)
    }
    return null
  } catch (error) {
    console.error("Error getting program design:", error)
    return null
  }
}

// Get full program data
export const getStoredProgram = async (): Promise<Program | null> => {
  try {
    const programJson = await AsyncStorage.getItem("current_program")
    if (programJson) {
      return JSON.parse(programJson)
    }
    return null
  } catch (error) {
    console.error("Error getting stored program:", error)
    return null
  }
}

// Helper function to format time
export const formatTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return ""
  try {
    // Handle various formats like H:MM, HH:MM, H:MMam/pm, HH:MMam/pm
    const cleanedTime = timeStr.toUpperCase().replace(/\s+/g, "") // Remove spaces
    const match = cleanedTime.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(AM|PM)?/)
    if (!match) return timeStr // Return original if format doesn't match

    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    let period = match[4] // AM/PM part

    if (isNaN(hours) || isNaN(minutes)) return timeStr

    if (period) {
      // Time includes AM/PM
      if (period === "PM" && hours !== 12) {
        hours += 12
      } else if (period === "AM" && hours === 12) {
        hours = 0 // Midnight case
      }
      // Hours are now effectively 24-hour format internally
    } else {
      // Assuming 24-hour format if no AM/PM provided
      if (hours < 0 || hours > 23) return timeStr // Invalid 24hr hour
    }

    // Format back to 12-hour AM/PM
    const finalHours12 = hours % 12 === 0 ? 12 : hours % 12
    const finalPeriod = hours >= 12 ? "PM" : "AM"
    const finalMinutesStr = minutes < 10 ? "0" + minutes : minutes

    return `${finalHours12}:${finalMinutesStr} ${finalPeriod}`
  } catch {
    return timeStr // Fallback on any error
  }
}
