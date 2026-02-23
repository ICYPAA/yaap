"use server"

import { logActivity } from "@/lib/audit-logger"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export interface UserWithRole {
  id: string
  email: string
  profile_name: string | null
  role: "admin" | "steering" | "host" | "volunteer" | null
  permissions: string[]
}

interface ActionResult<T = any> {
  success?: boolean
  error?: string
  users?: T[]
}

export async function getUsersWithRoles(): Promise<ActionResult<UserWithRole>> {
  const supabase = await createClient()

  // Get current user and check permissions
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Check permissions using RPC function
  const { data: hasPermission, error: permissionError } = await supabase.rpc(
    "check_role_management_permission"
  )

  if (permissionError) {
    console.error("Error checking permissions:", permissionError)
    return { error: "Failed to check permissions" }
  }

  if (!hasPermission) {
    return {
      error:
        "Insufficient permissions. Only admins and steering members can access role management."
    }
  }

  try {
    // Get all auth users using admin API with service role
    // Make sure we have the service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Service role key not found!")
      return { error: "Configuration error - service role key missing" }
    }
    
    const adminClient = await createClient(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // List all users - this should include everyone
    const {
      data: authData,
      error: authError
    } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000 // Get more users to ensure we don't miss anyone
    })
    
    const authUsers = authData?.users || []

    if (authError) {
      console.error("Error fetching auth users:", authError)
      return { error: "Failed to fetch user data" }
    }

    if (!authUsers || authUsers.length === 0) {
      return { users: [] }
    }
    
    // Debug: Log current user info
    console.log("Current user ID:", user.id)
    console.log("Current user email:", user.email)
    console.log("Total auth users:", authUsers.length)
    
    // Check if current user is in the list
    const currentUserInList = authUsers.find(u => u.id === user.id)
    if (!currentUserInList) {
      console.warn("Current user not found in auth users list!")
      // This shouldn't happen if the service role is working correctly
      // Log this as an error for debugging
      console.error("Current user details:", {
        id: user.id,
        email: user.email,
        app_metadata: user.app_metadata
      })
    } else {
      console.log("Current user found in list:", currentUserInList.email)
    }

    // Get all roles using RPC function
    const { data: rolesData, error: rolesError } = await supabase.rpc(
      "get_all_user_roles"
    )
    
    if (rolesError) {
      console.error("Error fetching roles:", rolesError)
      // Continue anyway - users might not have roles
    }

    // Get profile names for Discord users (including server nicknames)
    const { data: profileData, error: profileError } = await supabase
      .from("profile-names")
      .select("user_id, profile_name")

    if (profileError) {
      console.error("Error fetching profile data:", profileError)
      // Continue anyway, just won't have names
    }

    // Filter to include Discord users OR users with roles (like admins) OR current user
    const users: UserWithRole[] = authUsers
      .filter((authUser) => {
        // Always include the current user
        if (authUser.id === user.id) {
          console.log("Including current user:", user.email)
          return true
        }
        
        // Check if user has a role in the system
        const hasRole = rolesData?.some((r: any) => r.user_id === authUser.id)
        
        // Check if user logged in via Discord
        const isDiscordUser = authUser.app_metadata?.provider === 'discord' || 
                             authUser.user_metadata?.iss === 'https://discord.com/api' ||
                             authUser.user_metadata?.provider === 'discord'
        
        // Include user if they're a Discord user OR if they have a role (admin, steering, etc.)
        return isDiscordUser || hasRole
      })
      .map((authUser) => {
        const roleData = rolesData?.find((r: any) => r.user_id === authUser.id)
        const profileItem = profileData?.find((p) => p.user_id === authUser.id)
        
        // Try to get Discord name from multiple sources
        // profile_name contains the server nickname if available, otherwise Discord username
        const discordName = profileItem?.profile_name || 
                           authUser.user_metadata?.full_name || 
                           authUser.user_metadata?.name ||
                           authUser.user_metadata?.custom_claims?.global_name ||
                           null

        return {
          id: authUser.id,
          email: authUser.email || "",
          profile_name: discordName,
          role: roleData?.role || null,
          permissions: roleData?.permissions || []
        }
      })
      .sort((a, b) => {
        // Sort by role priority (admin first, then steering, then others)
        const roleOrder = { admin: 0, steering: 1, host: 2, volunteer: 3 }
        const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 4
        const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 4
        if (aOrder !== bOrder) return aOrder - bOrder

        // Then by name/email
        const aName = a.profile_name || a.email
        const bName = b.profile_name || b.email
        return aName.localeCompare(bName)
      })

    return { users }
  } catch (error) {
    console.error("Error in getUsersWithRoles:", error)
    return { error: "An unexpected error occurred" }
  }
}

export async function updateUserRole(
  targetUserId: string,
  newRole: "host" | "steering",
  permissions: string[]
): Promise<ActionResult> {
  const supabase = await createClient()

  // Get current user and check permissions
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  // Check permissions using RPC function
  const { data: hasPermission, error: permissionError } = await supabase.rpc(
    "check_role_management_permission"
  )

  if (permissionError) {
    console.error("Error checking permissions:", permissionError)
    return { error: "Failed to check permissions" }
  }

  if (!hasPermission) {
    return { error: "Insufficient permissions. Only admin and steering members can modify roles." }
  }

  // Don't allow changing admin roles
  const { data: targetUserRole, error: targetRoleError } = await supabase
    .from("roles")
    .select("role, permissions")
    .eq("user_id", targetUserId)
    .single()

  if (targetUserRole?.role === "admin") {
    return { error: "Admin roles cannot be modified through the UI" }
  }

  try {
    // Get target user info for logging
    const {
      data: { user: targetUser }
    } = await supabase.auth.admin.getUserById(targetUserId)
    const { data: profileData } = await supabase
      .from("profile-names")
      .select("profile_name")
      .eq("user_id", targetUserId)
      .single()

    const oldValues = {
      role: targetUserRole?.role,
      permissions: targetUserRole?.permissions || []
    }

    // For steering role, clear permissions (they get all permissions automatically)
    const finalPermissions = newRole === "steering" ? [] : permissions

    // Use RPC functions to update/insert roles
    let result
    let error
    
    if (!targetUserRole) {
      // User has no role, use insert function
      const { data: insertResult, error: insertError } = await supabase.rpc(
        "insert_user_role",
        {
          target_user_id: targetUserId,
          user_role: newRole,
          user_permissions: finalPermissions
        }
      )
      result = insertResult
      error = insertError
    } else {
      // User has existing role, use update function
      const { data: updateResult, error: updateError } = await supabase.rpc(
        "update_user_role",
        {
          target_user_id: targetUserId,
          user_role: newRole,
          user_permissions: finalPermissions
        }
      )
      result = updateResult
      error = updateError
    }
    
    if (error || !result?.success) {
      console.error("Error updating role:", error || result?.error)
      return { error: result?.error || "Failed to update role" }
    }

    // Log successful role update
    await logActivity({
      actionType: "update_user_role",
      metadata: {
        targetUserId,
        targetUserEmail: targetUser?.email,
        targetUserName: profileData?.profile_name,
        updatedBy: user.email,
        oldRole: targetUserRole?.role,
        oldPermissions: targetUserRole?.permissions || [],
        newRole,
        newPermissions: finalPermissions
      }
    })

    return { success: true }
  } catch (error) {
    console.error("Error in updateUserRole:", error)
    return { error: "An unexpected error occurred" }
  }
}
