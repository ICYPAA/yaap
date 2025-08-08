import React, { createContext, useContext, useEffect, useState } from "react"
import {
  Permission,
  UserRole,
  UserWithRole,
  getCurrentUserWithRole,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission
} from "../lib/roleChecker"
import { supabase } from "../lib/supabase"

interface RoleContextType {
  user: UserWithRole | null
  loading: boolean
  isAuthenticated: boolean

  // Permission checking functions
  hasPermission: (permission: Permission) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean

  // Role checking functions
  isRole: (role: UserRole) => boolean
  isAnyRole: (roles: UserRole[]) => boolean

  // Admin/Host checking shortcuts
  isSuperAdmin: () => boolean
  isHostAdmin: () => boolean
  isHostMember: () => boolean
  canAccessHostTools: () => boolean

  // Refresh user data
  refreshUser: () => Promise<void>
}

const RoleContext = createContext<RoleContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  hasPermission: () => false,
  hasAllPermissions: () => false,
  hasAnyPermission: () => false,
  isRole: () => false,
  isAnyRole: () => false,
  isSuperAdmin: () => false,
  isHostAdmin: () => false,
  isHostMember: () => false,
  canAccessHostTools: () => false,
  refreshUser: async () => {}
})

export const useRole = () => {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider")
  }
  return context
}

interface RoleProviderProps {
  children: React.ReactNode
}

export const RoleProvider: React.FC<RoleProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserWithRole | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  const loadUser = async () => {
    try {
      setLoading(true)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn("User role fetch timed out after 5 seconds")
          resolve(null)
        }, 5000)
      })
      
      // Race between getting user role and timeout
      const userWithRole = await Promise.race([
        getCurrentUserWithRole(),
        timeoutPromise
      ])
      
      setUser(userWithRole)
      setIsAuthenticated(!!userWithRole)
    } catch (error) {
      console.error("Error loading user with role:", error)
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial load
    loadUser()

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, !!session)

        if (event === "SIGNED_OUT" || !session) {
          setUser(null)
          setIsAuthenticated(false)
          setLoading(false)
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          await loadUser()
        }
      }
    )

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  // Permission checking functions
  const checkPermission = (permission: Permission): boolean => {
    if (!user) return false
    return hasPermission(user.role, permission)
  }

  const checkAllPermissions = (permissions: Permission[]): boolean => {
    if (!user) return false
    return hasAllPermissions(user.role, permissions)
  }

  const checkAnyPermission = (permissions: Permission[]): boolean => {
    if (!user) return false
    return hasAnyPermission(user.role, permissions)
  }

  // Role checking functions
  const isRole = (role: UserRole): boolean => {
    return user?.role === role
  }

  const isAnyRole = (roles: UserRole[]): boolean => {
    if (!user) return false
    return roles.includes(user.role)
  }

  // Shortcut functions
  const isSuperAdmin = (): boolean => isRole(UserRole.SUPER_ADMIN)
  const isHostAdmin = (): boolean => isRole(UserRole.HOST_ADMIN)
  const isHostMember = (): boolean => isRole(UserRole.HOST_MEMBER)

  const canAccessHostTools = (): boolean => {
    return isAnyRole([
      UserRole.SUPER_ADMIN,
      UserRole.HOST_ADMIN,
      UserRole.HOST_MEMBER,
      UserRole.VOLUNTEER_COORDINATOR,
      UserRole.ACCESSIBILITY_COORDINATOR,
      UserRole.HOSPITALITY_COORDINATOR,
      UserRole.SUPPORT_COORDINATOR
    ])
  }

  const refreshUser = async (): Promise<void> => {
    await loadUser()
  }

  const contextValue: RoleContextType = {
    user,
    loading,
    isAuthenticated,
    hasPermission: checkPermission,
    hasAllPermissions: checkAllPermissions,
    hasAnyPermission: checkAnyPermission,
    isRole,
    isAnyRole,
    isSuperAdmin,
    isHostAdmin,
    isHostMember,
    canAccessHostTools,
    refreshUser
  }

  return (
    <RoleContext.Provider value={contextValue}>{children}</RoleContext.Provider>
  )
}
