import { makeRedirectUri } from "expo-auth-session"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import React, { useState } from "react"
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { theme } from "../../../constants/theme"
import { supabase } from "../../../lib/supabase"

export default function HostLogin() {
  const [loading, setLoading] = useState(false)

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
            await supabase.auth.exchangeCodeForSession(
              extractedUrl.queryParams.code
            )
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
    ...theme.typography.h1,
    marginBottom: theme.spacing.md,
    color: theme.colors.text.primary
  },
  description: {
    ...theme.typography.body,
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
  }
})
