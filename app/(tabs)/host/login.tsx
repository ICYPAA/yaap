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
import { useDebug } from "../../../context/DebugContext"
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
  const { isDebugMode } = useDebug()
  const { setUserFromLogin, setIsLoggingIn } = useRole()
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

  // Handle session recovery for Android OAuth
  useEffect(() => {
    if (Platform.OS !== 'android') return
    
    console.log("Android: Setting up session recovery listener")
    
    // Also listen for deep links on Android
    const linkingListener = Linking.addEventListener('url', async ({ url }) => {
      console.log("Android: Deep link received:", url)
      
      if (url.includes('#access_token=')) {
        console.log("Android: Auth callback URL detected")
        
        // Extract tokens from the URL fragment
        const urlParts = url.split('#')
        if (urlParts.length > 1) {
          const params = new URLSearchParams(urlParts[1])
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')
          const provider_token = params.get('provider_token')
          
          console.log("Android: Extracted tokens from deep link")
          console.log("- Access token:", access_token ? "Found" : "Missing")
          console.log("- Refresh token:", refresh_token ? "Found" : "Missing")
          console.log("- Provider token:", provider_token ? "Found" : "Missing")
          
          if (access_token && refresh_token) {
            setIsLoggingIn(true)
            
            const authResult = await authenticateWithDiscord(
              access_token,
              refresh_token,
              provider_token || ''
            )
            
            if (authResult.success && authResult.user) {
              console.log("Android: Authentication successful via deep link")
              setUserFromLogin(authResult.user)
              router.replace("/(tabs)/host")
            } else {
              console.log("Android: Authentication failed, error:", authResult.error)
              Alert.alert("Login Error", authResult.error || "Authentication failed")
              setIsLoggingIn(false)
            }
            setLoading(false)
          }
        }
      }
    })
    
    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Android: Auth state changed:", event)
      console.log("Android: Session present:", !!session)
      console.log("Android: Provider token present:", !!session?.provider_token)
      
      // Handle multiple auth events that might indicate successful login
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session) {
        console.log("Android: Checking session for OAuth completion")
        
        // Check if we have required tokens for Discord auth
        const provider_token = session.provider_token
        const access_token = session.access_token
        const refresh_token = session.refresh_token
        
        // Check if this is a Discord OAuth session (has provider_token or provider_refresh_token)
        if (provider_token || session.user?.app_metadata?.provider === 'discord') {
          console.log("Android: Discord session detected")
          
          // If we don't have provider_token but have a Discord session, 
          // we might need to recover it
          if (!provider_token && session.user?.app_metadata?.provider === 'discord') {
            console.log("Android: Discord session without provider token, attempting direct auth")
            
            // Try to authenticate with just the access token
            if (access_token && refresh_token) {
              setIsLoggingIn(true)
              
              const authResult = await authenticateWithDiscord(
                access_token,
                refresh_token,
                '' // Empty provider token, the backend might not need it
              )
              
              if (authResult.success && authResult.user) {
                console.log("Android: Authentication successful (without provider token)")
                setUserFromLogin(authResult.user)
                router.replace("/(tabs)/host")
              } else {
                console.log("Android: Authentication failed, error:", authResult.error)
                Alert.alert("Login Error", authResult.error || "Authentication failed")
                setIsLoggingIn(false)
              }
              setLoading(false)
            }
          } else if (provider_token) {
            console.log("Android: Provider token found, authenticating...")
            setIsLoggingIn(true)
            
            const authResult = await authenticateWithDiscord(
              access_token,
              refresh_token,
              provider_token
            )
            
            if (authResult.success && authResult.user) {
              console.log("Android: Authentication successful")
              setUserFromLogin(authResult.user)
              router.replace("/(tabs)/host")
            } else {
              console.log("Android: Authentication failed, error:", authResult.error)
              Alert.alert("Login Error", authResult.error || "Authentication failed")
              setIsLoggingIn(false)
            }
            setLoading(false)
          }
        }
      }
    })
    
    return () => {
      linkingListener.remove()
      authListener?.subscription.unsubscribe()
    }
  }, [router, setUserFromLogin, setIsLoggingIn])

  // Create a redirect URI
  const redirectUri = makeRedirectUri({
    scheme: "yaap",
    path: "auth/callback"
  })

  const handleDiscordLogin = async () => {
    try {
      setLoading(true)
      setIsLoggingIn(true)
      console.log("=== Discord Login Process Started ===")
      console.log("Timestamp:", new Date().toISOString())
      console.log("Platform:", Platform.OS)
      console.log("Redirect URI:", redirectUri)

      console.log("Step 1: Initiating OAuth with Supabase...")
      console.log("Using redirectTo:", redirectUri)
      
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

      console.log("Step 2: OAuth URL received:", data?.url ? "Yes" : "No")
      if (data?.url) {
        console.log("OAuth URL length:", data.url.length)
        console.log("OAuth URL domain:", new URL(data.url).hostname)
      }

      if (data?.url) {
        console.log("Step 3: Opening WebBrowser for authentication...")
        
        // On Android, use openBrowserAsync and wait for session recovery
        if (Platform.OS === 'android') {
          console.log("Android detected: Using openBrowserAsync")
          
          // Set a timeout to handle if auth doesn't complete
          const timeoutId = setTimeout(() => {
            console.log("Android: Auth timeout reached, checking session manually")
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session) {
                console.log("Android: Found session after timeout, triggering auth state change")
                // Manually trigger the auth state change by refreshing the session
                supabase.auth.refreshSession()
              } else {
                console.log("Android: No session found after timeout")
                setLoading(false)
                setIsLoggingIn(false)
              }
            })
          }, 5000) // 5 second timeout
          
          await WebBrowser.openBrowserAsync(data.url)
          
          // Clear timeout if still pending
          clearTimeout(timeoutId)
          
          // For Android, the session will be recovered via onAuthStateChange
          console.log("Browser opened, waiting for session recovery...")
          // Don't setLoading(false) here - let the auth state change handler do it
          return
        }
        
        // iOS continues to use openAuthSessionAsync
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUri
        )
        console.log("Step 4: WebBrowser result received")
        console.log("Result type:", result.type)
        console.log(
          "Result URL present:",
          result.type === "success" && result.url ? "Yes" : "No"
        )

        if (result.type === "success") {
          console.log("Step 5: Processing success response...")
          console.log("Full URL:", result.url)

          // Extract tokens from the URL fragment
          const urlParts = result.url.split("#")
          console.log("URL has fragment:", urlParts.length > 1 ? "Yes" : "No")

          if (urlParts.length > 1) {
            const params = new URLSearchParams(urlParts[1])
            const access_token = params.get("access_token")
            const refresh_token = params.get("refresh_token")
            const provider_token = params.get("provider_token")

            console.log("Step 6: Token extraction results:")
            console.log("- Access token:", access_token ? "Found" : "Missing")
            console.log("- Refresh token:", refresh_token ? "Found" : "Missing")
            console.log(
              "- Provider token:",
              provider_token ? "Found" : "Missing"
            )

            if (access_token && refresh_token && provider_token) {
              console.log(
                "Step 7: All tokens found, running authentication flow..."
              )

              const authResult = await authenticateWithDiscord(
                access_token,
                refresh_token,
                provider_token
              )

              console.log(
                "Step 8: Authentication result:",
                authResult.success ? "SUCCESS" : "FAILED"
              )

              if (authResult.success && authResult.user) {
                console.log("Step 9: Setting user in RoleContext...")
                setUserFromLogin(authResult.user)
                console.log("Step 10: Navigation to host screen...")
                router.replace("/(tabs)/host")
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
              console.error("Step 6 FAILED: Missing required tokens")
              console.error("URL fragment content:", urlParts[1])
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
          console.log("Discord Login: User cancelled or dismissed.")
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
    console.log("Email Login: Running authentication flow...")

    const authResult = await authenticateWithEmail(email, password)

    if (authResult.success && authResult.user) {
      console.log("Email Login: Authentication successful, setting user in RoleContext")
      setUserFromLogin(authResult.user)
      console.log("Email Login: Navigating to host")
      router.replace("/(tabs)/host")
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
