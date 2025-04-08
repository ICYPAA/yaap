import { makeRedirectUri } from "expo-auth-session"
import { Href, useRouter } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import React, { useEffect, useState } from "react"
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { supabase } from "../../../lib/supabase"

export default function HostLogin() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailLoading, setEmailLoading] = useState(false)
  const styles = createStyles(theme)

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

  // Sign in with Email/Password
  async function handleSignInWithEmail() {
    setEmailLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })

    if (error) Alert.alert("Sign In Error", error.message)
    // No need to redirect here, onAuthStateChange handles it
    setEmailLoading(false)
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

      {/* Email/Password Login Section */}
      <View style={styles.separatorContainer}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorText}>OR</Text>
        <View style={styles.separatorLine} />
      </View>

      <TextInput
        style={styles.input}
        onChangeText={setEmail}
        value={email}
        placeholder="email@address.com"
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor={theme.colors.text.secondary}
        editable={!emailLoading}
      />
      <TextInput
        style={styles.input}
        onChangeText={setPassword}
        value={password}
        secureTextEntry={true}
        placeholder="Password"
        autoCapitalize="none"
        placeholderTextColor={theme.colors.text.secondary}
        editable={!emailLoading}
      />
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[
            styles.emailButton,
            styles.signInButton,
            styles.fullWidthButton
          ]}
          onPress={handleSignInWithEmail}
          disabled={emailLoading || loading}
        >
          <Text style={styles.emailButtonText}>
            {emailLoading ? "Signing In..." : "Sign In"}
          </Text>
        </TouchableOpacity>
      </View>

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
    loginButton: {
      backgroundColor: "#5865F2",
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.sm,
      minWidth: 200,
      alignItems: "center"
    },
    loginButtonText: {
      color: theme.colors.background,
      fontWeight: "500"
    },
    separatorContainer: {
      flexDirection: "row",
      alignItems: "center",
      width: "80%",
      marginVertical: theme.spacing.lg
    },
    separatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border
    },
    separatorText: {
      marginHorizontal: theme.spacing.sm,
      color: theme.colors.text.secondary,
      ...theme.typography.caption
    },
    input: {
      backgroundColor: theme.colors.surface,
      color: theme.colors.text.primary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.md,
      width: "80%",
      fontSize: theme.typography.body.fontSize
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "80%",
      marginTop: theme.spacing.xs
    },
    emailButton: {
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      flex: 1,
      alignItems: "center"
    },
    signInButton: {
      backgroundColor: theme.colors.primary
    },
    emailButtonText: {
      color: theme.colors.background,
      fontWeight: "500"
    },
    fullWidthButton: {
      marginHorizontal: 0
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
