import { createClient } from "@/utils/supabase/server"

export interface UserRole {
  id: string
  user_id: string
  role: string
  permissions: string[]
  created_at: string
  updated_at: string
}

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const supabase = await createClient()

  const { data: roles, error } = await supabase
    .from("roles")
    .select("*")
    .eq("user_id", userId)

  if (error) {
    console.error("Error fetching user roles:", error)
    return []
  }

  return roles || []
}

export async function hasPermission(
  userId: string,
  requiredRoles: string[] = [],
  requiredPermissions: string[] = []
): Promise<boolean> {
  const roles = await getUserRoles(userId)

  if (roles.length === 0) {
    return false
  }

  if (requiredRoles.length === 0 && requiredPermissions.length === 0) {
    return true
  }

  const hasRequiredRole =
    requiredRoles.length > 0 &&
    roles.some((role) => requiredRoles.includes(role.role))

  const hasRequiredPermission =
    requiredPermissions.length > 0 &&
    roles.some((role) =>
      requiredPermissions.some((permission) =>
        role.permissions.includes(permission)
      )
    )

  return hasRequiredRole || hasRequiredPermission
}

export async function canAccessRoleManagement(userId: string): Promise<boolean> {
  // Only admin and steering members can access role management
  return hasPermission(userId, ["admin", "steering"], [])
}

export async function canEditRoles(userId: string): Promise<boolean> {
  // Both admin and steering members can edit roles
  return hasPermission(userId, ["admin", "steering"], [])
}
