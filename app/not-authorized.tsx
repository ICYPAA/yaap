import { useRouter } from "expo-router"
import React from "react"
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useTheme } from "../context/ThemeContext"
import { supabase } from "../lib/supabase"

export default function NotAuthorizedScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const styles = createStyles(theme)

  const handleLogout = async () => {
    try {
      console.log("Logging out...")
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Logout error:", error)
        throw error
      }
      console.log("Logout successful, navigating to login")
      // Navigate to the host login page
      router.replace("/host/login")
    } catch (error) {
      console.error("Logout error:", error)
      Alert.alert(
        "Logout Error",
        "An error occurred during logout. Please try again."
      )
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Not Authorized</Text>
      <Text style={styles.description}>
        You've successfully signed in with Apple, but your account is not
        authorized to access the host committee features. Please contact the
        host committee administrator for assistance.
      </Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  )
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.lg,
      justifyContent: "center",
      alignItems: "center"
    },
    title: {
      fontSize: theme.typography.h1.fontSize,
      fontWeight: "700",
      marginBottom: theme.spacing.md,
      color: theme.colors.text.primary
    },
    description: {
      fontSize: theme.typography.body.fontSize,
      textAlign: "center",
      marginBottom: theme.spacing.xl,
      color: theme.colors.text.secondary
    },
    logoutButton: {
      backgroundColor: theme.colors.error,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.sm,
      minWidth: 200,
      alignItems: "center"
    },
    logoutButtonText: {
      color: "#ffffff",
      fontWeight: "500",
      fontSize: theme.typography.body.fontSize
    }
  })
