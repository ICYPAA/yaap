import FontAwesome6 from "@expo/vector-icons/FontAwesome6"
import * as AppleAuthentication from "expo-apple-authentication"
import { makeRedirectUri } from "expo-auth-session"
import { useRouter } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import React, { useEffect, useState } from "react"
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { authenticateWithDiscord, authenticateWithEmail } from "../../../lib/authService"
import { supabase } from "../../../lib/supabase"

export default function HostLogin() {
  const router = useRouter()
  const { theme } = useTheme()
  const { isDebugMode } = useDebug()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailLoading, setEmailLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false)
  const styles = createStyles(theme)

  // Check if Apple Authentication is available
  useEffect(() => {
    const checkAppleAuthAvailability = async () => {
      try {
        const available = await AppleAuthentication.isAvailableAsync()
        console.log("Apple Authentication available:", available)
        setIsAppleAuthAvailable(available)
      } catch (error) {
        console.error(
          "Error checking Apple Authentication availability:",
          error
        )
        setIsAppleAuthAvailable(false)
      }
    }
    checkAppleAuthAvailability()
  }, [])

  // Create a redirect URI
  const redirectUri = makeRedirectUri({
    scheme: "yaap",
    path: "auth/callback"
  })

  const handleDiscordLogin = async () => {
    try {
      setLoading(true)
      console.log("Discord Login: Starting...")
      console.log(`Discord Login: Redirect URI: ${redirectUri}`)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: redirectUri,
          scopes: "identify email guilds"
        }
      })

      if (error) throw error
      console.log(`Discord Login: OAuth URL: ${data?.url}`)

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri
        )
        console.log("Discord Login: Auth result:", JSON.stringify(result))

        if (result.type === "success") {
          console.log(
            "Discord Login: WebBrowser success, attempting to set session..."
          )
          // Extract tokens from the URL fragment
          const params = new URLSearchParams(result.url.split("#")[1])
          const access_token = params.get("access_token")
          const refresh_token = params.get("refresh_token")
          const provider_token = params.get("provider_token")

          if (access_token && refresh_token && provider_token) {
            console.log("Discord Login: Running authentication flow...")
            
            const authResult = await authenticateWithDiscord(
              access_token,
              refresh_token,
              provider_token
            )
            
            if (authResult.success) {
              console.log("Discord Login: Authentication successful, navigating to host")
              router.replace("/(tabs)/host")
            } else {
              console.error("Discord Login: Authentication failed:", authResult.error)
              Alert.alert("Login Error", authResult.error || "Authentication failed")
            }
          } else {
            console.warn(
              "Discord Login: Tokens (access, refresh, or provider) not found in redirect URL."
            )
            Alert.alert(
              "Login Error",
              "Could not retrieve all required login tokens."
            )
          }
        } else if (result.type === "cancel" || result.type === "dismiss") {
          console.log("Discord Login: User cancelled or dismissed.")
        } else {
          console.warn(
            "Discord Login: WebBrowser returned non-success result:",
            result.type
          )
        }
      }
    } catch (error) {
      console.error("Discord login error:", error)
      Alert.alert(
        "Login Error",
        error instanceof Error
          ? error.message
          : "An unknown error occurred during login. Please try again."
      )
    } finally {
      setLoading(false)
    }
  }

  // Sign in with Email/Password
  async function handleSignInWithEmail() {
    setEmailLoading(true)
    console.log("Email Login: Running authentication flow...")
    
    const authResult = await authenticateWithEmail(email, password)
    
    if (authResult.success) {
      console.log("Email Login: Authentication successful, navigating to host")
      router.replace("/(tabs)/host")
    } else {
      console.error("Email Login: Authentication failed:", authResult.error)
      Alert.alert("Sign In Error", authResult.error || "Authentication failed")
    }
    
    setEmailLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Host Committee Login</Text>
        <Text style={styles.description}>
          Access host committee features and settings by logging in with your
          Discord account.
        </Text>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleDiscordLogin}
          disabled={loading || emailLoading || appleLoading}
        >
          <FontAwesome6
            name="discord"
            size={20}
            color="#e0e3ff"
            style={styles.iconStyle}
          />
          <Text style={styles.loginButtonText}>
            {loading ? "Logging in..." : "Login with Discord"}
          </Text>
        </TouchableOpacity>

        {/* Apple Sign In Button */}
        {Platform.OS === "ios" && isAppleAuthAvailable && (
          <View style={styles.appleButtonContainer}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={5}
              style={styles.appleNativeButton}
              onPress={async () => {
                try {
                  setAppleLoading(true)
                  console.log("Apple Login: Starting...")

                  const credential = await AppleAuthentication.signInAsync({
                    requestedScopes: [
                      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                      AppleAuthentication.AppleAuthenticationScope.EMAIL
                    ]
                  })

                  // Sign in via Supabase Auth
                  if (credential.identityToken) {
                    console.log(
                      "Apple Login: Got identity token, signing in with Supabase..."
                    )

                    const { error } = await supabase.auth.signInWithIdToken({
                      provider: "apple",
                      token: credential.identityToken
                    })

                    if (error) throw error

                    console.log(
                      "Apple Login: Successful login, redirecting to not authorized page..."
                    )
                    router.push("/not-authorized" as any)
                  } else {
                    throw new Error("No identityToken from Apple Sign In.")
                  }
                } catch (e: any) {
                  if (e.code === "ERR_REQUEST_CANCELED") {
                    console.log("Apple Login: User canceled the login.")
                  } else {
                    console.error("Apple login error:", e)
                    Alert.alert(
                      "Login Error",
                      e instanceof Error
                        ? e.message
                        : "An unknown error occurred during Apple login. Please try again."
                    )
                  }
                } finally {
                  setAppleLoading(false)
                }
              }}
            />
          </View>
        )}

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
          editable={!emailLoading && !loading}
        />
        <TextInput
          style={styles.input}
          onChangeText={setPassword}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          autoCapitalize="none"
          placeholderTextColor={theme.colors.text.secondary}
          editable={!emailLoading && !loading}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.emailButton,
              styles.signInButton,
              styles.fullWidthButton,
              (emailLoading || loading) && styles.disabledButton
            ]}
            onPress={handleSignInWithEmail}
            disabled={emailLoading || loading}
          >
            <Text style={styles.emailButtonText}>
              {emailLoading ? "Signing In..." : "Sign In"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    scrollContent: {
      flexGrow: 1,
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
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      width: "80%",
      height: 56,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center"
    },
    iconStyle: {
      marginRight: theme.spacing.sm
    },
    loginButtonText: {
      color: "#e0e3ff",
      fontWeight: "bold",
      fontSize: theme.typography.body.fontSize
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
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      color: theme.colors.text.primary,
      ...theme.typography.body,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.md,
      width: "80%"
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      width: "80%",
      marginTop: theme.spacing.lg
    },
    emailButton: {
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      flex: 1,
      alignItems: "center"
    },
    signInButton: {
      backgroundColor: theme.colors.primary
    },
    emailButtonText: {
      fontWeight: "bold",
      fontSize: theme.typography.body.fontSize,
      color: "#fff"
    },
    fullWidthButton: {
      marginHorizontal: 0
    },
    disabledButton: {
      backgroundColor: theme.colors.border,
      opacity: 0.7
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
    },
    appleButtonContainer: {
      marginTop: theme.spacing.md,
      alignItems: "center",
      width: "80%"
    },
    appleNativeButton: {
      width: "100%",
      height: 56
    }
  })
