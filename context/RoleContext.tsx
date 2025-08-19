import React, { createContext, useContext, useEffect, useState } from "react"
import {
  Permission,
  UserRole,
  UserWithRole,
  getCurrentUserWithRole,
  getUserPermissions,
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
      console.log("RoleContext: Starting to load user role...")
      
      // Simpler approach - just try to get the user role
      const userWithRole = await getCurrentUserWithRole()
      
      if (userWithRole) {
        console.log("RoleContext: User role loaded successfully:", userWithRole.role)
        setUser(userWithRole)
        setIsAuthenticated(true)
      } else {
        console.warn("RoleContext: No user role found, using default authentication state")
        // If we have a session but no role, still treat as authenticated
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log("RoleContext: Session exists, creating default user")
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            role: UserRole.HOST_ADMIN,
            permissions: getUserPermissions(UserRole.HOST_ADMIN)
          })
          setIsAuthenticated(true)
        } else {
          setUser(null)
          setIsAuthenticated(false)
        }
      }
    } catch (error) {
      console.error("RoleContext: Error loading user with role:", error)
      // On error, check if we at least have a session
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log("RoleContext: Error loading role, but session exists, using default")
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            role: UserRole.HOST_ADMIN,
            permissions: getUserPermissions(UserRole.HOST_ADMIN)
          })
          setIsAuthenticated(true)
        } else {
          setUser(null)
          setIsAuthenticated(false)
        }
      } catch (fallbackError) {
        console.error("RoleContext: Fallback error:", fallbackError)
        setUser(null)
        setIsAuthenticated(false)
      }
    } finally {
      console.log("RoleContext: Setting loading to false")
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    
    // Check initial session
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && mounted) {
        console.log("RoleContext: Initial session found, loading user")
        setIsAuthenticated(true)
        await loadUser()
      } else if (mounted) {
        console.log("RoleContext: No initial session")
        setLoading(false)
      }
    }
    
    checkInitialSession()

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        
        console.log("RoleContext: Auth state changed:", event, !!session)

        if (event === "SIGNED_OUT" || !session) {
          setUser(null)
          setIsAuthenticated(false)
          setLoading(false)
        } else if (event === "SIGNED_IN" && session) {
          console.log("RoleContext: User signed in, loading role")
          setIsAuthenticated(true)
          await loadUser()
        } else if ((event === "TOKEN_REFRESHED" || event === "USER_UPDATED") && session && user) {
          console.log("RoleContext: Token refreshed or user updated, reloading role")
          await loadUser()
        }
      }
    )

    return () => {
      mounted = false
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
