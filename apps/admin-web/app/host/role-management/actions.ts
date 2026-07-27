"use server"

import { logActivity } from "@/lib/audit-logger"
import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

type ManagedRole = "host" | "steering"
type UserRole = "admin" | "steering" | "host" | "volunteer"

interface RoleMutationResult {
  success?: boolean
  error?: string
}

export interface UserWithRole {
  id: string
  email: string
  profile_name: string | null
  role: UserRole | null
  permissions: string[]
}

interface ActionResult<T = unknown> {
  success?: boolean
  error?: string
  users?: T[]
}

async function requireRoleManager() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/")
  }

  const { data: canManage, error: permissionError } = await supabase.rpc(
    "check_role_management_permission"
  )

  if (permissionError) {
    return {
      supabase,
      user,
      error: "Failed to check access permissions"
    }
  }

  if (!canManage) {
    return {
      supabase,
      user,
      error:
        "Insufficient permissions. Only admins and steering members can view this page."
    }
  }

  return { supabase, user, error: null }
}

export async function getUsersWithRoles(): Promise<ActionResult<UserWithRole>> {
  const { supabase, error: accessError } = await requireRoleManager()

  if (accessError) {
    return { error: accessError }
  }

  const { data, error } = await supabase.rpc(
    "get_conference_admin_users"
  )

  if (error) {
    console.error("Unable to list admin users:", error)
    return { error: "Failed to fetch user accounts" }
  }

  return { users: (data || []) as UserWithRole[] }
}

export async function updateUserRole(
  targetUserId: string,
  newRole: ManagedRole,
  permissions: string[]
): Promise<ActionResult> {
  const { supabase, user, error: accessError } = await requireRoleManager()

  if (accessError) {
    return { error: accessError }
  }

  const { data: targetRole, error: targetRoleError } = await supabase
    .from("roles")
    .select("role, permissions")
    .eq("user_id", targetUserId)
    .maybeSingle()

  if (targetRoleError) {
    return { error: "Failed to fetch the current role" }
  }

  if (targetRole?.role === "admin") {
    return { error: "Admin roles cannot be modified through the UI" }
  }

  const finalPermissions = newRole === "steering" ? [] : permissions
  const functionName = targetRole ? "update_user_role" : "insert_user_role"
  const { data, error } = await supabase.rpc(functionName, {
    target_user_id: targetUserId,
    user_role: newRole,
    user_permissions: finalPermissions
  })
  const result = data as RoleMutationResult | null

  if (error || !result?.success) {
    console.error("Unable to update role:", error || result?.error)
    return { error: result?.error || "Failed to update role" }
  }

  await logActivity({
    actionType: "update_user_role",
    metadata: {
      targetUserId,
      updatedBy: user.email,
      oldRole: targetRole?.role || null,
      oldPermissions: targetRole?.permissions || [],
      newRole,
      newPermissions: finalPermissions
    }
  })

  return { success: true }
}

export async function removeUserRole(
  targetUserId: string
): Promise<ActionResult> {
  const { supabase, user, error: accessError } = await requireRoleManager()

  if (accessError) {
    return { error: accessError }
  }

  const { data: targetRole, error: targetRoleError } = await supabase
    .from("roles")
    .select("role")
    .eq("user_id", targetUserId)
    .maybeSingle()

  if (targetRoleError) {
    return { error: "Failed to fetch the current role" }
  }

  if (!targetRole) {
    return { success: true }
  }

  if (targetRole.role === "admin") {
    return { error: "Admin roles cannot be modified through the UI" }
  }

  const { data, error } = await supabase.rpc("delete_user_role", {
    target_user_id: targetUserId,
    user_role: targetRole.role
  })
  const result = data as RoleMutationResult | null

  if (error || !result?.success) {
    return { error: result?.error || error?.message || "Failed to remove role" }
  }

  await logActivity({
    actionType: "remove_user_role",
    metadata: {
      targetUserId,
      oldRole: targetRole.role,
      updatedBy: user.email
    }
  })

  return { success: true }
}
