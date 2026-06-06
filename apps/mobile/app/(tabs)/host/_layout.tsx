import { Redirect, Stack, usePathname } from "expo-router"
import React from "react"
import { StyleSheet, View, Text, ActivityIndicator } from "react-native"
import { useDebug } from "../../../context/DebugContext"
import { useRole } from "../../../context/RoleContext"
import { useTheme } from "../../../context/ThemeContext"

export default function HostLayout() {
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const { loading, isAuthenticated, canAccessHostTools, isLoggingIn } = useRole()
  const pathname = usePathname()

  // Check if current route is the login page
  const isLoginPage = pathname?.includes("/host/login")

  // Log the current state
  console.log(
    `HostLayout: loading=${loading}, isAuthenticated=${isAuthenticated}, isLoggingIn=${isLoggingIn}, isLoginPage=${isLoginPage}, pathname=${pathname}`
  )

  // Always show loading while checking roles for authenticated users OR during login
  // This ensures we have the role data before showing any host content
  if ((loading || isLoggingIn) && !isLoginPage) {
    console.log("HostLayout: Showing loading screen (loading or logging in)")
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>
          {isLoggingIn ? "Logging in..." : "Checking permissions..."}
        </Text>
      </View>
    )
  }

  // After loading is complete, we know the authentication and role state
  const isAuthed = isAuthenticated

  // If in debug mode, we don't redirect to login
  if (isDebugMode) {
    console.log("HostLayout: Debug mode, allowing access")
    // Allow access in debug mode
  } else if (!isAuthed && !isLoginPage) {
    console.log("HostLayout: Not authenticated, redirecting to login")
    // Redirect to login if not authenticated and not already on login page
    return <Redirect href="/host/login" />
  } else if (isAuthed && isLoginPage) {
    console.log(
      "HostLayout: Authenticated and on login page, redirecting to host index"
    )
    // If authenticated and on login page, redirect to host index
    return <Redirect href="/host" />
  } else if (isAuthed && !canAccessHostTools() && !isLoginPage) {
    console.log(
      "HostLayout: Authenticated but no host access, redirecting to not-authorized"
    )
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
