import { supabase } from "./supabase"
import { UserWithRole, getUserPermissions, getUserRoleAndPermissions } from "./roleChecker"
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
  try {
    // Step 1: First decode the JWT to get user info WITHOUT setting session
    const base64Url = access_token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    
    const tokenData = JSON.parse(jsonPayload)
    const userId = tokenData.sub
    const userEmail = tokenData.email
    
    // Step 2: Verify Discord server membership BEFORE setting any session
    const discordHostServerId = process.env.EXPO_PUBLIC_DISCORD_HOST_SERVER ?? "1282888358502334575"
    
    const guildsResponse = await fetch(
      "https://discord.com/api/v10/users/@me/guilds",
      {
        headers: {
          Authorization: `Bearer ${provider_token}`
        }
      }
    )

    if (!guildsResponse.ok) {
      const errorText = await guildsResponse.text()
      console.error("Discord verification failed:", {
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
    const isMember = guilds.some((guild: any) => guild.id === discordHostServerId)
    
    if (!isMember) {
      console.error("Discord verification failed: user is not in host server")
      
      // Don't set session if not authorized
      return { 
        success: false, 
        error: "You must be a member of the ICYPAA Host Discord server to log in." 
      }
    }
    
    // Step 3: Set the session first so we can make authenticated database calls
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    })
    
    if (sessionError) {
      console.error("Could not set Supabase session:", sessionError)
      return { 
        success: false, 
        error: `Session setup failed: ${sessionError.message}` 
      }
    }

    // Step 4: Now check user role and permissions from database with active session
    // Small delay to ensure session is fully propagated
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const { role: userRole, permissions: dbPermissions } = await getUserRoleAndPermissions(userId)
    
    // Step 5: Verify session was set correctly
    const { data: { session: verifySession } } = await supabase.auth.getSession()
    if (!verifySession?.user) {
      return {
        success: false,
        error: "Session setup failed: verification did not return a user"
      }
    }
    
    // Step 6: Create user object with role and permissions
    const userWithRole: UserWithRole = {
      id: userId,
      email: userEmail || "",
      role: userRole,
      permissions: getUserPermissions(userRole, dbPermissions),
      dbPermissions
    }
    
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
  try {
    // Step 1: Sign in with email/password
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (signInError) {
      console.error("Email sign-in failed:", signInError)
      return { 
        success: false, 
        error: signInError.message 
      }
    }
    
    if (!signInData.session || !signInData.user) {
      console.error("Email sign-in did not return a session or user")
      return { 
        success: false, 
        error: "Authentication failed - no session created" 
      }
    }

    const userId = signInData.user.id
    const userEmail = signInData.user.email || ""

    // Step 2: Check user role and permissions from database
    const { role: userRole, permissions: dbPermissions } = await getUserRoleAndPermissions(userId)
    
    // Step 3: Create user object with role and permissions
    const userWithRole: UserWithRole = {
      id: userId,
      email: userEmail,
      role: userRole,
      permissions: getUserPermissions(userRole, dbPermissions),
      dbPermissions
    }
    
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
