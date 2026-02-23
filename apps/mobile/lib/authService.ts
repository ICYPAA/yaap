import { Alert } from "react-native"
import { supabase } from "./supabase"
import { UserWithRole, UserRole, getUserPermissions, getUserRoleAndPermissions } from "./roleChecker"
import { logSecurityEvent, SecurityEventType } from "./security/monitoring"
import { getSessionManager } from "./security/session"

interface AuthResult {
  success: boolean
  user?: UserWithRole
  error?: string
}

/**
 * Complete authentication flow for Discord login
 * IMPORTANT: Complete ALL checks BEFORE setting session to avoid auth state interruptions
 */
export async function authenticateWithDiscord(
  access_token: string,
  refresh_token: string,
  provider_token: string
): Promise<AuthResult> {
  console.log("=== Starting Discord Authentication Flow ===")
  console.log("Timestamp:", new Date().toISOString())
  console.log("Tokens received:", {
    access_token: access_token ? `${access_token.substring(0, 10)}...` : 'missing',
    refresh_token: refresh_token ? `${refresh_token.substring(0, 10)}...` : 'missing',
    provider_token: provider_token ? `${provider_token.substring(0, 10)}...` : 'missing'
  })
  
  try {
    // Step 1: First decode the JWT to get user info WITHOUT setting session
    console.log("Step 1: Decoding access token to get user info...")
    const base64Url = access_token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    
    const tokenData = JSON.parse(jsonPayload)
    const userId = tokenData.sub
    const userEmail = tokenData.email
    
    console.log("User ID from token:", userId)
    console.log("User email from token:", userEmail)
    
    // DETAILED JWT TOKEN DATA
    console.log("=== FULL JWT TOKEN PAYLOAD ===")
    console.log(JSON.stringify(tokenData, null, 2))
    console.log("=== END JWT TOKEN ===")
    
    // Step 2: Verify Discord server membership BEFORE setting any session
    console.log("Step 2: Verifying Discord server membership...")
    const discordHostServerId = process.env.EXPO_PUBLIC_DISCORD_HOST_SERVER ?? "1282888358502334575"
    console.log("Looking for Discord server ID:", discordHostServerId)
    
    console.log("Fetching Discord guilds from API...")
    const guildsResponse = await fetch(
      "https://discord.com/api/v10/users/@me/guilds",
      {
        headers: {
          Authorization: `Bearer ${provider_token}`
        }
      }
    )
    
    console.log("Discord API response status:", guildsResponse.status)
    
    if (!guildsResponse.ok) {
      const errorText = await guildsResponse.text()
      console.error("Step 2 FAILED: Discord API error:", {
        status: guildsResponse.status,
        statusText: guildsResponse.statusText,
        errorBody: errorText
      })
      return { 
        success: false, 
        error: `Discord verification failed: ${guildsResponse.status} - ${errorText}` 
      }
    }
    
    const guilds = await guildsResponse.json()
    console.log(`User is member of ${guilds.length} Discord servers`)
    console.log("Server IDs:", guilds.map((g: any) => ({ id: g.id, name: g.name })))
    
    // DETAILED DISCORD GUILD DATA
    console.log("=== FULL DISCORD GUILDS RESPONSE BODY ===")
    console.log(JSON.stringify(guilds, null, 2))
    console.log("=== END DISCORD GUILDS ===")
    
    const isMember = guilds.some((guild: any) => guild.id === discordHostServerId)
    
    if (!isMember) {
      console.error("Step 2 FAILED: User is not a member of the host Discord server")
      console.error("Required server ID:", discordHostServerId)
      console.error("User's servers:", guilds.map((g: any) => g.id))
      
      // Don't set session if not authorized
      return { 
        success: false, 
        error: "You must be a member of the ICYPAA Host Discord server to log in." 
      }
    }
    console.log("Step 2 SUCCESS: User is member of host Discord server")
    
    // Step 3: Set the session first so we can make authenticated database calls
    console.log("Step 3: Setting Supabase session...")
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    })
    
    if (sessionError) {
      console.error("Step 3 FAILED: Could not set session:", sessionError)
      return { 
        success: false, 
        error: `Session setup failed: ${sessionError.message}` 
      }
    }
    
    console.log("Step 3 SUCCESS: Session set")
    
    // Step 4: Now check user role and permissions from database with active session
    console.log("Step 4: Checking user role and permissions from database...")
    
    // Small delay to ensure session is fully propagated
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const { role: userRole, permissions: dbPermissions } = await getUserRoleAndPermissions(userId)
    
    console.log("Step 4 SUCCESS: User role determined:", userRole)
    console.log("Step 4: Database permissions:", dbPermissions)
    
    // Step 5: Verify session was set correctly
    const { data: { session: verifySession } } = await supabase.auth.getSession()
    console.log("=== SESSION VERIFICATION ===")
    console.log("Session exists:", !!verifySession)
    console.log("Session user ID:", verifySession?.user?.id)
    console.log("Session user email:", verifySession?.user?.email)
    console.log("Session expires at:", verifySession?.expires_at)
    console.log("=== END SESSION VERIFICATION ===")
    
    // Step 6: Create user object with role and permissions
    const userWithRole: UserWithRole = {
      id: userId,
      email: userEmail || "",
      role: userRole,
      permissions: getUserPermissions(userRole, dbPermissions),
      dbPermissions
    }
    
    console.log("=== Authentication Flow Complete ===")
    console.log("User authenticated with role:", userRole)
    
    // Log successful authentication
    await logSecurityEvent(
      SecurityEventType.LOGIN_SUCCESS,
      'low',
      { role: userRole, provider: 'discord' },
      userId
    )
    
    // Initialize session manager for auto-refresh
    const sessionManager = getSessionManager()
    await sessionManager.initialize()
    
    return {
      success: true,
      user: userWithRole
    }
    
  } catch (error) {
    console.error("Authentication flow failed with unexpected error:", error)
    // Don't set session if there was an error
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }
  }
}

/**
 * Complete authentication flow for email/password login
 * IMPORTANT: Complete ALL checks BEFORE setting session to avoid auth state interruptions
 */
export async function authenticateWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  console.log("=== Starting Email Authentication Flow ===")
  
  try {
    // Step 1: Sign in with email/password
    console.log("Step 1: Signing in with email/password...")
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (signInError) {
      console.error("Step 1 FAILED: Sign in error:", signInError)
      return { 
        success: false, 
        error: signInError.message 
      }
    }
    
    if (!signInData.session || !signInData.user) {
      console.error("Step 1 FAILED: No session or user returned")
      return { 
        success: false, 
        error: "Authentication failed - no session created" 
      }
    }
    
    console.log("Step 1 SUCCESS: Credentials verified")
    const userId = signInData.user.id
    const userEmail = signInData.user.email || ""
    
    // DETAILED SIGN IN DATA
    console.log("=== FULL SUPABASE SIGN IN RESPONSE ===")
    console.log("User data:", JSON.stringify(signInData.user, null, 2))
    console.log("Session data:", JSON.stringify({
      access_token: signInData.session?.access_token ? "present" : "missing",
      refresh_token: signInData.session?.refresh_token ? "present" : "missing",
      expires_at: signInData.session?.expires_at,
      expires_in: signInData.session?.expires_in,
      token_type: signInData.session?.token_type
    }, null, 2))
    console.log("=== END SIGN IN DATA ===")
    
    // Step 2: Check user role and permissions from database
    console.log("Step 2: Checking user role and permissions from database...")
    const { role: userRole, permissions: dbPermissions } = await getUserRoleAndPermissions(userId)
    
    console.log("Step 2 SUCCESS: User role determined:", userRole)
    console.log("Step 2: Database permissions:", dbPermissions)
    
    // Step 3: Create user object with role and permissions
    const userWithRole: UserWithRole = {
      id: userId,
      email: userEmail,
      role: userRole,
      permissions: getUserPermissions(userRole, dbPermissions),
      dbPermissions
    }
    
    console.log("=== Authentication Flow Complete ===")
    console.log("User authenticated with role:", userRole)
    
    // Log successful authentication
    await logSecurityEvent(
      SecurityEventType.LOGIN_SUCCESS,
      'low',
      { role: userRole, provider: 'email' },
      userId
    )
    
    // Initialize session manager for auto-refresh
    const sessionManager = getSessionManager()
    await sessionManager.initialize()
    
    return {
      success: true,
      user: userWithRole
    }
    
  } catch (error) {
    console.error("Authentication flow failed with unexpected error:", error)
    // Sign out if there was an error
    await supabase.auth.signOut()
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }
  }
}