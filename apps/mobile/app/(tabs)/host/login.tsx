import FontAwesome6 from "@expo/vector-icons/FontAwesome6"
import * as AppleAuthentication from "expo-apple-authentication"
import { makeRedirectUri } from "expo-auth-session"
import * as Linking from "expo-linking"
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
import { useTheme } from "../../../context/ThemeContext"
import { useRole } from "../../../context/RoleContext"
import {
  authenticateWithDiscord,
  authenticateWithEmail
} from "../../../lib/authService"
import { supabase } from "../../../lib/supabase"

export default function HostLogin() {
  const router = useRouter()
  const { theme } = useTheme()
  const { setUserFromLogin, setIsLoggingIn } = useRole()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailLoading, setEmailLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false)
  const [pendingProviderToken, setPendingProviderToken] = useState<string | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
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

  // Handle session recovery for Android OAuth
  useEffect(() => {
    if (Platform.OS !== 'android') return
    
    // Track if we've already attempted authentication for this session
    let hasAttemptedAuth = false
    let authTimeoutId: ReturnType<typeof setTimeout> | null = null
    
    // Also listen for deep links on Android
    const linkingListener = Linking.addEventListener('url', async ({ url }) => {
      if (url.includes('#access_token=')) {
        // Extract tokens from the URL fragment
        const urlParts = url.split('#')
        if (urlParts.length > 1) {
          const params = new URLSearchParams(urlParts[1])
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          const provider_token = params.get('provider_token')
          
          // Store the provider token for later use
          if (provider_token) {
            setPendingProviderToken(provider_token)
          }
          
          if (access_token && refresh_token) {
            // Prevent duplicate authentication
            if (isAuthenticating || hasAttemptedAuth) {
              return
            }
            
            hasAttemptedAuth = true
            setIsAuthenticating(true)
            setIsLoggingIn(true)
            
            // Clear any pending auth timeout
            if (authTimeoutId) {
              clearTimeout(authTimeoutId)
              authTimeoutId = null
            }
            
            try {
              const authResult = await authenticateWithDiscord(
                access_token,
                refresh_token,
                provider_token || ''
              )
              
              if (authResult.success && authResult.user) {
                setUserFromLogin(authResult.user)
                // Give more time for context to update and prevent race condition
                setTimeout(() => {
                  router.replace("/(tabs)/host")
                }, 500)
              } else {
                console.error("Android authentication failed:", authResult.error)
                Alert.alert("Login Error", authResult.error || "Authentication failed")
                setIsLoggingIn(false)
                setIsAuthenticating(false)
                hasAttemptedAuth = false // Reset on failure
              }
            } catch (err) {
              console.error("Android: Exception during authentication:", err)
              Alert.alert("Login Error", "An unexpected error occurred during authentication")
              setIsLoggingIn(false)
              setIsAuthenticating(false)
              hasAttemptedAuth = false // Reset on error
            } finally {
              setLoading(false)
              setPendingProviderToken(null) // Clear after use
            }
          }
        }
      }
    })
    
    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle SIGNED_IN event for OAuth, ignore TOKEN_REFRESHED for existing sessions
      if (event === 'SIGNED_IN' && session) {
        // Check if we have required tokens for Discord auth
        let provider_token = session.provider_token || pendingProviderToken
        const access_token = session.access_token
        const refresh_token = session.refresh_token
        
        // Skip if already authenticating or already authenticated
        if (isAuthenticating || hasAttemptedAuth) {
          return
        }
        
        // Check if this is a Discord OAuth session (has provider_token or provider_refresh_token)
        if (provider_token || session.user?.app_metadata?.provider === 'discord') {
          // If we don't have provider_token but have a Discord session, 
          // wait briefly for it to be set via deep link
          if (!provider_token && session.user?.app_metadata?.provider === 'discord') {
            // Set a timeout to check for provider token
            authTimeoutId = setTimeout(() => {
              if (pendingProviderToken && !hasAttemptedAuth && !isAuthenticating) {
                handleAuthWithTokens(access_token, refresh_token, pendingProviderToken)
              } else {
                setLoading(false)
                setIsLoggingIn(false)
              }
            }, 1000) // Wait 1 second for provider token
            return
          }
          
          if (provider_token && access_token && refresh_token) {
            handleAuthWithTokens(access_token, refresh_token, provider_token)
          }
        }
      }
    })
    
    const handleAuthWithTokens = async (access_token: string, refresh_token: string, provider_token: string) => {
      if (hasAttemptedAuth || isAuthenticating) {
        return
      }

      hasAttemptedAuth = true
      setIsAuthenticating(true)
      setIsLoggingIn(true)
      
      try {
        const authResult = await authenticateWithDiscord(
          access_token,
          refresh_token,
          provider_token
        )
        
        if (authResult.success && authResult.user) {
          setUserFromLogin(authResult.user)
          setTimeout(() => {
            router.replace("/(tabs)/host")
          }, 500)
          setPendingProviderToken(null) // Clear after successful auth
        } else {
          console.error("Android authentication failed:", authResult.error)
          Alert.alert("Login Error", authResult.error || "Authentication failed")
          setIsLoggingIn(false)
          setIsAuthenticating(false)
          hasAttemptedAuth = false // Reset on failure
        }
      } catch (err) {
        console.error("Android: Exception in auth handler:", err)
        setIsAuthenticating(false)
        setIsLoggingIn(false)
        hasAttemptedAuth = false // Reset on error
      } finally {
        setLoading(false)
      }
    }
    
    return () => {
      linkingListener.remove()
      authListener?.subscription.unsubscribe()
      if (authTimeoutId) {
        clearTimeout(authTimeoutId)
      }
    }
  }, [router, setUserFromLogin, setIsLoggingIn, pendingProviderToken, isAuthenticating])

  // Create a redirect URI
  const redirectUri = makeRedirectUri({
    scheme: "yaap",
    path: "auth/callback"
  })

  const handleDiscordLogin = async () => {
    try {
      setLoading(true)
      setIsLoggingIn(true)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: redirectUri,
          scopes: "identify email guilds"
        }
      })

      if (error) {
        console.error("OAuth initiation error:", error)
        throw error
      }

      if (data?.url) {
        // On Android, use openBrowserAsync and wait for session recovery
        if (Platform.OS === 'android') {
          // Set a timeout to handle if auth doesn't complete
          const timeoutId = setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session) {
                // Manually trigger the auth state change by refreshing the session
                supabase.auth.refreshSession()
              } else {
                setLoading(false)
                setIsLoggingIn(false)
              }
            })
          }, 5000) // 5 second timeout
          
          await WebBrowser.openBrowserAsync(data.url)
          
          // Clear timeout if still pending
          clearTimeout(timeoutId)
          
          // For Android, the session will be recovered via onAuthStateChange
          // Don't setLoading(false) here - let the auth state change handler do it
          return
        }
        
        // iOS continues to use openAuthSessionAsync
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri
        )

        if (result.type === "success") {
          // Extract tokens from the URL fragment
          const urlParts = result.url.split("#")

          if (urlParts.length > 1) {
            const params = new URLSearchParams(urlParts[1])
            const access_token = params.get("access_token")
            const refresh_token = params.get("refresh_token")
            const provider_token = params.get("provider_token")

            if (access_token && refresh_token && provider_token) {
              const authResult = await authenticateWithDiscord(
                access_token,
                refresh_token,
                provider_token
              )

              if (authResult.success && authResult.user) {
                setUserFromLogin(authResult.user)
                setTimeout(() => {
                  router.replace("/(tabs)/host")
                }, 500)
              } else {
                console.error(
                  "Authentication failed with error:",
                  authResult.error
                )
                Alert.alert(
                  "Login Error",
                  authResult.error || "Authentication failed"
                )
                setIsLoggingIn(false)
              }
            } else {
              console.error("Discord login response was missing required tokens")
              Alert.alert(
                "Login Error",
                "Could not retrieve all required login tokens from Discord response."
              )
              setIsLoggingIn(false)
            }
          } else {
            console.error("Step 5 FAILED: No URL fragment found in response")
            Alert.alert(
              "Login Error",
              "Invalid response format from Discord authentication."
            )
            setIsLoggingIn(false)
          }
        } else if (result.type === "cancel" || result.type === "dismiss") {
          setIsLoggingIn(false)
        } else {
          console.warn(
            "Discord Login: WebBrowser returned non-success result:",
            result.type
          )
          setIsLoggingIn(false)
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
      setIsLoggingIn(false)
    } finally {
      setLoading(false)
    }
  }

  // Sign in with Email/Password
  async function handleSignInWithEmail() {
    setEmailLoading(true)
    setIsLoggingIn(true)

    const authResult = await authenticateWithEmail(email, password)

    if (authResult.success && authResult.user) {
      setUserFromLogin(authResult.user)
      setTimeout(() => {
        router.replace("/(tabs)/host")
      }, 500)
    } else {
      console.error("Email Login: Authentication failed:", authResult.error)
      Alert.alert("Sign In Error", authResult.error || "Authentication failed")
      setIsLoggingIn(false)
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
