import { supabase } from "./supabase"
import { UserWithRole, getUserPermissions, getUserRoleAndPermissions } from "./roleChecker"
import { logSecurityEvent, SecurityEventType } from "./security/monitoring"
import { getSessionManager } from "./security/session"

interface AuthResult {
  success: boolean
  user?: UserWithRole
  error?: string
}

const discordMembershipVerificationEnabled =
  process.env.EXPO_PUBLIC_DISCORD_MEMBERSHIP_VERIFICATION_ENABLED === "true"

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
    // Establish the Supabase session so the Edge Function can bind the Discord
    // token to the authenticated Supabase identity. Host data remains blocked
    // by RLS until that trusted verification succeeds.
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
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

    const sessionUser = sessionData.session?.user
    if (!sessionUser) {
      await supabase.auth.signOut()
      return { success: false, error: "Session setup did not return a user" }
    }

    if (discordMembershipVerificationEnabled) {
      const { data: verification, error: verificationError } =
        await supabase.functions.invoke("verify_discord_membership", {
          body: { provider_token }
        })

      if (verificationError || verification?.success !== true) {
        let verificationMessage = verification?.error
        const errorContext = (verificationError as { context?: Response } | null)
          ?.context

        if (!verificationMessage && errorContext) {
          try {
            const errorBody = await errorContext.clone().json()
            verificationMessage = errorBody?.error
          } catch {
            // The generic message below is safe when the function returned a
            // non-JSON platform error.
          }
        }

        console.error("Server-side Discord membership verification failed")
        await supabase.auth.signOut()
        return {
          success: false,
          error:
            verificationMessage ||
            "We could not verify membership in the host Discord server."
        }
      }
    }

    const userId = sessionUser.id
    const userEmail = sessionUser.email
    const { role: userRole, permissions: dbPermissions } = await getUserRoleAndPermissions(userId)
    
    // Verify the session persisted after membership provisioning.
    const { data: { session: verifySession } } = await supabase.auth.getSession()
    if (!verifySession?.user) {
      return {
        success: false,
        error: "Session setup failed: verification did not return a user"
      }
    }
    
    const userWithRole: UserWithRole = {
      id: userId,
      email: userEmail || "",
      role: userRole,
      permissions: getUserPermissions(userRole, dbPermissions),
      dbPermissions
    }
    
    await logSecurityEvent(
      SecurityEventType.LOGIN_SUCCESS,
      'low',
      { role: userRole, provider: 'discord' },
      userId
    )
    
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
