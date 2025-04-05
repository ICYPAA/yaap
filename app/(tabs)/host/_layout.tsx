import { Redirect, Stack, usePathname } from "expo-router"
import React, { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { supabase } from "../../../lib/supabase"

export default function HostLayout() {
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const pathname = usePathname()

  // Check if current route is the login page
  const isLoginPage = pathname === "/host/login"

  useEffect(() => {
    // If in debug mode, we skip authentication check
    if (isDebugMode) {
      setIsAuthenticated(true)
      return
    }

    // The listener will fire initially with the restored session or null.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("session", session)
        // This will set the state correctly after storage is checked
        // or after the redirect tokens are processed.
        setIsAuthenticated(!!session)
      }
    )

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [isDebugMode])

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles(theme).loadingText}>
          Checking authentication...
        </Text>
      </View>
    )
  }

  // If in debug mode, we don't redirect to login
  // Otherwise, redirect to login if not authenticated and not already on login page
  if (!isAuthenticated && !isLoginPage && !isDebugMode) {
    return <Redirect href="/host/login" />
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
      <Stack.Screen name="rides" options={{ headerShown: false }} />
      <Stack.Screen name="volunteers" options={{ headerShown: false }} />
      <Stack.Screen name="hospitality" options={{ headerShown: false }} />
      <Stack.Screen name="support" options={{ headerShown: false }} />
      <Stack.Screen
        name="test-notifications"
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
