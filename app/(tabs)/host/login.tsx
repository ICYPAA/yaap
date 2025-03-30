import { makeRedirectUri } from "expo-auth-session"
import * as Linking from "expo-linking"
import { useRouter } from "expo-router"
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

  // Check if user is already logged in or if in debug mode
  useEffect(() => {
    checkUserSession()
  }, [isDebugMode])

  const checkUserSession = async () => {
    try {
      // In debug mode, we can skip the auth check and consider user as logged in
      if (isDebugMode) {
        router.replace("/host/index" as any)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session) {
        // User is already logged in, redirect to dashboard
        router.replace("/host/index" as any)
      }
    } catch (error) {
      console.error("Error checking session:", error)
    } finally {
      setInitialLoading(false)
    }
  }

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
          // Handle the redirect back to the app
          const { url } = result
          const extractedUrl = Linking.parse(url)

          // Exchange the code for a session
          if (extractedUrl.queryParams?.code) {
            if (typeof extractedUrl.queryParams.code === "string") {
              await supabase.auth.exchangeCodeForSession(
                extractedUrl.queryParams.code
              )
              router.replace("/host/index" as any)
            }
          }
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
