import { Platform } from "react-native"

// Generic ICYPAA palette. Individual conferences override primary/secondary.
const colors = {
  primary: "#263869",
  primaryDark: "#1A274A",
  secondary: "#4267A5",
  secondaryDark: "#304B78",
  error: "#f55654",
  success: "#4caf50",
  warning: "#fad48a",
  info: "#DCE7F6"
}

// Typography
const typography = {
  h1: {
    fontSize: 24,
    fontWeight: "bold"
  },
  h2: {
    fontSize: 20,
    fontWeight: "bold"
  },
  h3: {
    fontSize: 18,
    fontWeight: "bold"
  },
  body: {
    fontSize: 16
  },
  caption: {
    fontSize: 14
  }
}

// Spacing
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
}

// Border radius
const borderRadius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24
}

// Shadows
const shadows = {
  small: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4
    },
    android: {
      elevation: 3
    },
    default: {}
  }),
  medium: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8
    },
    android: {
      elevation: 5
    },
    default: {}
  }),
  large: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12
    },
    android: {
      elevation: 8
    },
    default: {}
  })
}

// Define the base theme with all shared properties
const baseTheme = {
  spacing,
  borderRadius,
  typography,
  shadows
}

// Light theme
export const lightTheme = {
  ...baseTheme,
  colors: {
    ...colors,
    background: "#ffffff",
    surface: "#f5f5f5",
    border: "#e0e0e0",
    text: {
      primary: "#212121",
      secondary: "#757575"
    }
  }
}

// Dark theme
export const darkTheme = {
  ...baseTheme,
  colors: {
    ...colors,
    background: "#121212",
    surface: "#1e1e1e",
    border: "#333333",
    text: {
      primary: "#ffffff",
      secondary: "#b0b0b0"
    }
  },
  shadows: {
    ...shadows,
    small: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4
      },
      android: {
        elevation: 3
      },
      default: {}
    })
  }
}

// Default theme (for backward compatibility)
export const theme = lightTheme
export const darkThemeColors = darkTheme.colors
