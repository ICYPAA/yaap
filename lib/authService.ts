import { Alert } from "react-native"
import { supabase } from "./supabase"
import { getCurrentUserWithRole, UserWithRole } from "./roleChecker"
import { logSecurityEvent, SecurityEventType } from "./security/monitoring"
import { getSessionManager } from "./security/session"

interface AuthResult {
  success: boolean
  user?: UserWithRole
  error?: string
}

/**
 * Complete authentication flow for Discord login
 * 1. Supabase auth -> 2. Discord server check -> 3. Role check -> Success
 */
export async function authenticateWithDiscord(
  access_token: string,
  refresh_token: string,
  provider_token: string
): Promise<AuthResult> {
  console.log("=== Starting Discord Authentication Flow ===")
  
  try {
    // Step 1: Set Supabase session
    console.log("Step 1: Setting Supabase session...")
    const { error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token
    })
    
    if (sessionError) {
      console.error("Step 1 FAILED: Could not set session:", sessionError)
      return { 
        success: false, 
        error: `Session setup failed: ${sessionError.message}` 
      }
    }
    console.log("Step 1 SUCCESS: Session set")
    
    // Initialize session manager for auto-refresh
    const sessionManager = getSessionManager()
    await sessionManager.initialize()
    
    // Step 2: Verify Discord server membership
    console.log("Step 2: Verifying Discord server membership...")
    const discordHostServerId = process.env.EXPO_PUBLIC_DISCORD_HOST_SERVER ?? "1282888358502334575"
    
    try {
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
        console.error("Step 2 FAILED: Discord API error:", guildsResponse.status, errorText)
        await supabase.auth.signOut()
        return { 
          success: false, 
          error: `Discord verification failed: ${guildsResponse.status}` 
        }
      }
      
      const guilds = await guildsResponse.json()
      const isMember = guilds.some((guild: any) => guild.id === discordHostServerId)
      
      if (!isMember) {
        console.error("Step 2 FAILED: User is not a member of the host Discord server")
        
        // Log security event for failed authentication
        const { data: { user } } = await supabase.auth.getUser()
        await logSecurityEvent(
          SecurityEventType.LOGIN_FAILURE,
          'medium',
          { reason: 'Not member of required Discord server' },
          user?.id
        )
        
        await supabase.auth.signOut()
        return { 
          success: false, 
          error: "You must be a member of the ICYPAA Host Discord server to log in." 
        }
      }
      console.log("Step 2 SUCCESS: User is member of host Discord server")
      
    } catch (discordError) {
      console.error("Step 2 FAILED: Discord API error:", discordError)
      await supabase.auth.signOut()
      return { 
        success: false, 
        error: "Could not verify Discord server membership" 
      }
    }
    
    // Step 3: Get user role
    console.log("Step 3: Fetching user role...")
    const userWithRole = await getCurrentUserWithRole()
    
    if (!userWithRole) {
      console.error("Step 3 FAILED: Could not get user role (THIS SHOULD NOT HAPPEN)")
      // This shouldn't happen if auth succeeded, but we'll handle it
      await supabase.auth.signOut()
      return { 
        success: false, 
        error: "Could not retrieve user role" 
      }
    }
    
    console.log("Step 3 SUCCESS: User role retrieved:", userWithRole.role)
    console.log("=== Authentication Flow Complete ===")
    
    // Log successful authentication
    await logSecurityEvent(
      SecurityEventType.LOGIN_SUCCESS,
      'low',
      { role: userWithRole.role, provider: 'discord' },
      userWithRole.id
    )
    
    return {
      success: true,
      user: userWithRole
    }
    
  } catch (error) {
    console.error("Authentication flow failed with unexpected error:", error)
    await supabase.auth.signOut()
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }
  }
}

/**
 * Complete authentication flow for email/password login
 */
export async function authenticateWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  console.log("=== Starting Email Authentication Flow ===")
  
  try {
    // Step 1: Sign in with email/password
    console.log("Step 1: Signing in with email/password...")
    const { error: signInError } = await supabase.auth.signInWithPassword({
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
    console.log("Step 1 SUCCESS: Signed in with email")
    
    // Step 2: Get user role (email users are typically admin)
    console.log("Step 2: Fetching user role...")
    const userWithRole = await getCurrentUserWithRole()
    
    if (!userWithRole) {
      console.error("Step 2 FAILED: Could not get user role (THIS SHOULD NOT HAPPEN)")
      await supabase.auth.signOut()
      return { 
        success: false, 
        error: "Could not retrieve user role" 
      }
    }
    
    console.log("Step 2 SUCCESS: User role retrieved:", userWithRole.role)
    console.log("=== Authentication Flow Complete ===")
    
    return {
      success: true,
      user: userWithRole
    }
    
  } catch (error) {
    console.error("Authentication flow failed with unexpected error:", error)
    await supabase.auth.signOut()
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }
  }
}