import { supabase } from "./supabase"

// Define available roles and permissions
export enum UserRole {
  SUPER_ADMIN = "super_admin",
  STEERING = "steering",
  HOST_ADMIN = "host_admin",
  HOST_MEMBER = "host_member",
  VOLUNTEER_COORDINATOR = "volunteer_coordinator",
  ACCESSIBILITY_COORDINATOR = "accessibility_coordinator",
  HOSPITALITY_COORDINATOR = "hospitality_coordinator",
  SUPPORT_COORDINATOR = "support_coordinator",
  USER = "user"
}

export enum Permission {
  // Volunteer management
  MANAGE_VOLUNTEERS = "manage_volunteers",
  VIEW_VOLUNTEERS = "view_volunteers",

  // Accessibility
  MANAGE_ACCESSIBILITY = "manage_accessibility",
  VIEW_ACCESSIBILITY = "view_accessibility",

  // Hospitality
  MANAGE_HOSPITALITY = "manage_hospitality",
  VIEW_HOSPITALITY = "view_hospitality",

  // Support/Chat
  MANAGE_SUPPORT = "manage_support",
  VIEW_SUPPORT = "view_support",
  SUPPORT_READ = "support:read",
  SUPPORT_EDIT = "support:edit",

  // Notifications
  SEND_NOTIFICATIONS = "send_notifications",
  NOTIFICATIONS_SEND = "notifications:send",

  // Admin functions
  MANAGE_USERS = "manage_users",
  MANAGE_ROLES = "manage_roles",
  VIEW_ANALYTICS = "view_analytics"
}

// Role to permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    Permission.MANAGE_VOLUNTEERS,
    Permission.VIEW_VOLUNTEERS,
    Permission.MANAGE_ACCESSIBILITY,
    Permission.VIEW_ACCESSIBILITY,
    Permission.MANAGE_HOSPITALITY,
    Permission.VIEW_HOSPITALITY,
    Permission.MANAGE_SUPPORT,
    Permission.VIEW_SUPPORT,
    Permission.SUPPORT_READ,
    Permission.SUPPORT_EDIT,
    Permission.SEND_NOTIFICATIONS,
    Permission.NOTIFICATIONS_SEND,
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.VIEW_ANALYTICS
  ],
  [UserRole.STEERING]: [
    Permission.MANAGE_VOLUNTEERS,
    Permission.VIEW_VOLUNTEERS,
    Permission.MANAGE_ACCESSIBILITY,
    Permission.VIEW_ACCESSIBILITY,
    Permission.MANAGE_HOSPITALITY,
    Permission.VIEW_HOSPITALITY,
    Permission.MANAGE_SUPPORT,
    Permission.VIEW_SUPPORT,
    Permission.SUPPORT_READ,
    Permission.SUPPORT_EDIT,
    Permission.SEND_NOTIFICATIONS,
    Permission.NOTIFICATIONS_SEND,
    Permission.VIEW_ANALYTICS
  ],
  [UserRole.HOST_ADMIN]: [
    Permission.MANAGE_VOLUNTEERS,
    Permission.VIEW_VOLUNTEERS,
    Permission.MANAGE_ACCESSIBILITY,
    Permission.VIEW_ACCESSIBILITY,
    Permission.MANAGE_HOSPITALITY,
    Permission.VIEW_HOSPITALITY,
    Permission.MANAGE_SUPPORT,
    Permission.VIEW_SUPPORT,
    Permission.SUPPORT_READ,
    Permission.SUPPORT_EDIT,
    Permission.SEND_NOTIFICATIONS,
    Permission.NOTIFICATIONS_SEND,
    Permission.VIEW_ANALYTICS
  ],
  [UserRole.HOST_MEMBER]: [
    Permission.VIEW_VOLUNTEERS,
    Permission.VIEW_ACCESSIBILITY,
    Permission.VIEW_HOSPITALITY,
    Permission.VIEW_SUPPORT,
    Permission.SUPPORT_READ
  ],
  [UserRole.VOLUNTEER_COORDINATOR]: [
    Permission.MANAGE_VOLUNTEERS,
    Permission.VIEW_VOLUNTEERS
  ],
  [UserRole.ACCESSIBILITY_COORDINATOR]: [
    Permission.MANAGE_ACCESSIBILITY,
    Permission.VIEW_ACCESSIBILITY
  ],
  [UserRole.HOSPITALITY_COORDINATOR]: [
    Permission.MANAGE_HOSPITALITY,
    Permission.VIEW_HOSPITALITY,
    Permission.NOTIFICATIONS_SEND
  ],
  [UserRole.SUPPORT_COORDINATOR]: [
    Permission.MANAGE_SUPPORT,
    Permission.VIEW_SUPPORT,
    Permission.SUPPORT_READ,
    Permission.SUPPORT_EDIT
  ],
  [UserRole.USER]: []
}

// Interface for user with role information
export interface UserWithRole {
  id: string
  email: string
  role: UserRole
  permissions: Permission[]
}

// Function to get user role from database
export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    console.log("Fetching role for user:", userId)
    
    const { data, error } = await supabase
      .from("roles")  // Use existing 'roles' table
      .select("role")
      .eq("user_id", userId)
      .maybeSingle() // Use maybeSingle instead of single to avoid error if no row exists

    if (error) {
      console.error("Error fetching user role:", error)
      return UserRole.HOST_ADMIN // Default to HOST_ADMIN for Discord-authenticated users
    }

    // Map the role from database to our UserRole enum
    // The existing table uses 'host' as the default role
    const dbRole = data?.role || "host"
    let mappedRole: UserRole
    
    switch(dbRole) {
      case "super_admin":
        mappedRole = UserRole.SUPER_ADMIN
        break
      case "steering":
        mappedRole = UserRole.STEERING
        break
      case "host":
      case "host_admin":
        mappedRole = UserRole.HOST_ADMIN
        break
      case "host_member":
        mappedRole = UserRole.HOST_MEMBER
        break
      default:
        mappedRole = UserRole.HOST_ADMIN // Default to HOST_ADMIN for host users
    }
    
    console.log("User role retrieved:", mappedRole)
    return mappedRole
  } catch (error) {
    console.error("Error in getUserRole:", error)
    return UserRole.HOST_ADMIN // Default to HOST_ADMIN for Discord-authenticated users
  }
}

// Function to get user permissions based on role
export function getUserPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || []
}

// Function to check if user has specific permission
export function hasPermission(
  userRole: UserRole,
  permission: Permission
): boolean {
  const permissions = getUserPermissions(userRole)
  return permissions.includes(permission)
}

// Function to check multiple permissions (user must have ALL permissions)
export function hasAllPermissions(
  userRole: UserRole,
  permissions: Permission[]
): boolean {
  const userPermissions = getUserPermissions(userRole)
  return permissions.every((permission) => userPermissions.includes(permission))
}

// Function to check multiple permissions (user must have AT LEAST ONE permission)
export function hasAnyPermission(
  userRole: UserRole,
  permissions: Permission[]
): boolean {
  const userPermissions = getUserPermissions(userRole)
  return permissions.some((permission) => userPermissions.includes(permission))
}

// Function to get current authenticated user with role
export async function getCurrentUserWithRole(): Promise<UserWithRole | null> {
  try {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) return null

    // Get role from database, defaults to HOST_ADMIN if not found
    const role = await getUserRole(user.id)
    const permissions = getUserPermissions(role)

    return {
      id: user.id,
      email: user.email || "",
      role,
      permissions
    }
  } catch (error) {
    console.error("Error getting current user with role:", error)
    return null
  }
}
