import { Redirect, Stack, usePathname } from "expo-router"
import React from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { useDebug } from "../../../context/DebugContext"
import { useRole } from "../../../context/RoleContext"
import { useTheme } from "../../../context/ThemeContext"

export default function HostLayout() {
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const { loading, isAuthenticated, canAccessHostTools } = useRole()
  const pathname = usePathname()

  // Check if current route is the login page
  const isLoginPage = pathname === "/host/login"

  // Show loading while checking authentication and roles
  if (loading) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>Checking permissions...</Text>
      </View>
    )
  }

  // If in debug mode, we don't redirect to login
  if (isDebugMode) {
    // Allow access in debug mode
  } else if (!isAuthenticated && !isLoginPage) {
    // Redirect to login if not authenticated and not already on login page
    return <Redirect href="/host/login" />
  } else if (isAuthenticated && !canAccessHostTools() && !isLoginPage) {
    // Redirect to unauthorized if authenticated but doesn't have host access
    return <Redirect href="/not-authorized" />
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
          // Don't require authentication for the login screen
          animation: "none"
        }}
      />
      <Stack.Screen name="accessibility" options={{ headerShown: false }} />
      <Stack.Screen name="volunteers" options={{ headerShown: false }} />
      <Stack.Screen name="hospitality" options={{ headerShown: false }} />
      <Stack.Screen name="support" options={{ headerShown: false }} />
      <Stack.Screen name="chairperson" options={{ headerShown: false }} />
      <Stack.Screen
        name="general-notifications"
        options={{ headerShown: false }}
      />
    </Stack>
  )
}

const styles = (theme: any) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.colors.background
    },
    loadingText: {
      fontSize: theme.typography.body.fontSize,
      color: theme.colors.text.primary,
      marginTop: theme.spacing.md
    }
  })
