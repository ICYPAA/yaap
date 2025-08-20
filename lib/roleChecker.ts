import { supabase } from "./supabase"

// Define available roles and permissions
export enum UserRole {
  ADMIN = "admin",
  STEERING = "steering",
  ADVISORY = "advisory",
  HOST = "host",
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

// All available permissions for admin/steering/advisory roles
const ALL_PERMISSIONS: Permission[] = [
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
]

// Basic permissions for HOST role (when no specific permissions are defined)
const BASIC_HOST_PERMISSIONS: Permission[] = [
  Permission.VIEW_VOLUNTEERS,
  Permission.VIEW_ACCESSIBILITY,
  Permission.VIEW_HOSPITALITY,
  Permission.VIEW_SUPPORT,
  Permission.SUPPORT_READ
]

// Interface for user with role information
export interface UserWithRole {
  id: string
  email: string
  role: UserRole
  permissions: Permission[]
  dbPermissions?: string[] // Raw permissions from database
}

// Function to get user role and permissions from database
export async function getUserRoleAndPermissions(userId: string): Promise<{ role: UserRole, permissions: string[] }> {
  try {
    console.log("getUserRoleAndPermissions: Fetching role for user:", userId)
    const startTime = Date.now()

    // First verify we have a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log("=== SESSION CHECK BEFORE ROLE QUERY ===")
    console.log("Session exists:", !!session)
    console.log("Session user ID:", session?.user?.id)
    console.log("Session access token exists:", !!session?.access_token)
    console.log("Session error:", sessionError)
    console.log("=== END SESSION CHECK ===")

    // Try multiple query approaches to debug
    console.log("Attempting query 1: Standard select with user_id filter")
    const { data, error } = await supabase
      .from("roles")
      .select("role, permissions")
      .eq("user_id", userId)
      .maybeSingle()

    const queryTime = Date.now() - startTime
    console.log(`getUserRoleAndPermissions: Query completed in ${queryTime}ms`)
    
    // DETAILED ROLE QUERY DATA
    console.log("=== getUserRoleAndPermissions DATABASE QUERY RESULT ===")
    console.log("Query data:", JSON.stringify(data, null, 2))
    console.log("Query error:", error)
    console.log("=== END getUserRoleAndPermissions QUERY ===")

    // If first query returns null, try with explicit select all
    if (!data && !error) {
      console.log("First query returned null, trying select * query...")
      const { data: allData, error: allError } = await supabase
        .from("roles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()
      
      console.log("=== SECOND QUERY ATTEMPT (select *) ===")
      console.log("Query data:", JSON.stringify(allData, null, 2))
      console.log("Query error:", allError)
      console.log("=== END SECOND QUERY ===")

      // Also try without maybeSingle to see if there are multiple rows
      const { data: multiData, error: multiError } = await supabase
        .from("roles")
        .select("*")
        .eq("user_id", userId)
      
      console.log("=== THIRD QUERY ATTEMPT (no maybeSingle) ===")
      console.log("Query data:", JSON.stringify(multiData, null, 2))
      console.log("Number of rows:", multiData?.length || 0)
      console.log("Query error:", multiError)
      console.log("=== END THIRD QUERY ===")
    }

    if (error) {
      console.error("getUserRoleAndPermissions: Error fetching user role:", error)
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return { role: UserRole.HOST, permissions: [] }
    }

    // If no role found in database, default to HOST
    if (!data?.role) {
      console.log("getUserRoleAndPermissions: No role found in database, using default HOST")
      console.log("Returning to check: Is data null?", data === null)
      console.log("Is data undefined?", data === undefined)
      console.log("Raw data value:", data)
      return { role: UserRole.HOST, permissions: [] }
    }

    // Map the role from database to our UserRole enum
    const dbRole = data.role
    let mappedRole: UserRole

    switch (dbRole) {
      case "admin":
        mappedRole = UserRole.ADMIN
        break
      case "steering":
        mappedRole = UserRole.STEERING
        break
      case "advisory":
        mappedRole = UserRole.ADVISORY
        break
      case "host":
        mappedRole = UserRole.HOST
        break
      default:
        console.warn(`getUserRoleAndPermissions: Unknown role '${dbRole}', defaulting to HOST`)
        mappedRole = UserRole.HOST
    }

    console.log("getUserRoleAndPermissions: User role retrieved:", mappedRole)
    console.log("getUserRoleAndPermissions: User permissions:", data.permissions || [])
    
    return {
      role: mappedRole,
      permissions: data.permissions || []
    }
  } catch (error: any) {
    console.error("getUserRoleAndPermissions: Unexpected error:", error)
    return { role: UserRole.HOST, permissions: [] }
  }
}

// Backward compatibility function
export async function getUserRole(userId: string): Promise<UserRole> {
  const { role } = await getUserRoleAndPermissions(userId)
  return role
}

// Function to get user permissions based on role and database permissions
export function getUserPermissions(role: UserRole, dbPermissions?: string[]): Permission[] {
  // Admin, Steering, and Advisory get all permissions
  if (role === UserRole.ADMIN || role === UserRole.STEERING || role === UserRole.ADVISORY) {
    return ALL_PERMISSIONS
  }
  
  // Host role gets permissions from database or basic permissions
  if (role === UserRole.HOST) {
    if (dbPermissions && dbPermissions.length > 0) {
      // Map database permission strings to Permission enum
      // For now, return basic permissions plus any matching permissions
      const mappedPermissions: Permission[] = [...BASIC_HOST_PERMISSIONS]
      
      // Map common database permissions to our enum
      dbPermissions.forEach(perm => {
        switch(perm) {
          case "volunteers:manage":
            mappedPermissions.push(Permission.MANAGE_VOLUNTEERS)
            break
          case "accessibility:manage":
            mappedPermissions.push(Permission.MANAGE_ACCESSIBILITY)
            break
          case "hospitality:manage":
            mappedPermissions.push(Permission.MANAGE_HOSPITALITY)
            break
          case "support:manage":
            mappedPermissions.push(Permission.MANAGE_SUPPORT)
            break
          case "support:edit":
            mappedPermissions.push(Permission.SUPPORT_EDIT)
            break
          case "notifications:send":
            mappedPermissions.push(Permission.SEND_NOTIFICATIONS)
            mappedPermissions.push(Permission.NOTIFICATIONS_SEND)
            break
        }
      })
      
      // Remove duplicates
      return [...new Set(mappedPermissions)]
    }
    return BASIC_HOST_PERMISSIONS
  }
  
  // User role gets no permissions
  return []
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
    console.log("getCurrentUserWithRole: Starting...")
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error("getCurrentUserWithRole: Session error:", sessionError)
      return null
    }

    console.log(
      "getCurrentUserWithRole: Session retrieved:",
      !!session?.user,
      "User ID:",
      session?.user?.id
    )

    if (!session?.user) {
      console.log("getCurrentUserWithRole: No user in session")
      return null
    }

    // Get role and permissions from database
    console.log(
      "getCurrentUserWithRole: About to call getUserRoleAndPermissions for:",
      session.user.id
    )
    
    const { role, permissions: dbPermissions } = await getUserRoleAndPermissions(session.user.id)
    console.log("getCurrentUserWithRole: Role retrieved:", role)
    console.log("getCurrentUserWithRole: DB Permissions:", dbPermissions)

    const permissions = getUserPermissions(role, dbPermissions)
    console.log(
      "getCurrentUserWithRole: Permissions calculated, returning user"
    )

    return {
      id: session.user.id,
      email: session.user.email || "",
      role,
      permissions,
      dbPermissions
    }
  } catch (error) {
    console.error("getCurrentUserWithRole: Caught error:", error)
    return null
  }
}
