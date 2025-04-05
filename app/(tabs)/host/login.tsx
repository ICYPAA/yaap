import { makeRedirectUri } from "expo-auth-session"
import { Href, useRouter } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import React, { useEffect, useState } from "react"
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { theme } from "../../../constants/theme"
import { useDebug } from "../../../context/DebugContext"
import { supabase } from "../../../lib/supabase"

export default function HostLogin() {
  const router = useRouter()
  const { isDebugMode } = useDebug()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // Listen for authentication state changes
  useEffect(() => {
    // Set initial loading to false once the first auth event is received.
    let receivedFirstEvent = false

    // Check if debug mode bypasses auth
    if (isDebugMode) {
      console.log("Debug mode enabled, bypassing auth check.")
      router.replace("/host/index" as Href)
      setInitialLoading(false)
      return // Don't set up the listener if in debug mode
    }

    // Get current session immediately (optional, but can speed up initial load)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!receivedFirstEvent) {
        if (session) {
          console.log("Found active session on initial check.")
          router.replace("/host" as Href)
        } else {
          console.log("No active session on initial check.")
        }
        setInitialLoading(false)
        receivedFirstEvent = true
      }
    })

    // Set up the listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("Auth state changed:", _event, !!session)
        if (!receivedFirstEvent) {
          // If getSession finished first, this prevents double-redirect
          setInitialLoading(false)
          receivedFirstEvent = true
        }

        if (session) {
          // User is logged in, redirect
          router.replace("/host/index" as Href)
        } else {
          // User is logged out, ensure loading is false so login shows
          setInitialLoading(false)
        }
      }
    )

    // Cleanup function to unsubscribe when the component unmounts
    return () => {
      authListener?.subscription.unsubscribe()
    }
  }, [isDebugMode, router]) // Add router to dependency array

  // Create a redirect URI
  const redirectUri = makeRedirectUri({
    scheme: "icypaa",
    path: "auth/callback"
  })

  const handleDiscordLogin = async () => {
    try {
      setLoading(true)

      // Get the URL to the Supabase OAuth sign in page for Discord
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: redirectUri
        }
      })

      if (error) throw error

      // Open the browser for authentication
      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri
        )

        if (result.type === "success") {
          // Session is automatically set by the Supabase client library via AsyncStorage.
          // We can just navigate to the protected route.
          router.replace("/host" as Href)
        }
      }
    } catch (error) {
      console.error("Discord login error:", error)
      Alert.alert(
        "Login Error",
        "An error occurred during login. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.description}>Checking login status...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Host Committee Login</Text>
      <Text style={styles.description}>
        Access host committee features and settings by logging in with your
        Discord account.
      </Text>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={handleDiscordLogin}
        disabled={loading}
      >
        <Text style={styles.loginButtonText}>
          {loading ? "Logging in..." : "Login with Discord"}
        </Text>
      </TouchableOpacity>

      {isDebugMode && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Debug mode is enabled. Authentication is bypassed.
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
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
  loginButton: {
    backgroundColor: "#5865F2", // Discord brand color
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    minWidth: 200,
    alignItems: "center"
  },
  loginButtonText: {
    color: theme.colors.background,
    fontWeight: "500"
  },
  debugContainer: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: "rgba(255, 0, 0, 0.05)",
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error
  },
  debugText: {
    color: theme.colors.error,
    fontSize: theme.typography.caption.fontSize
  }
})
