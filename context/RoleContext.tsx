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
  isLoggingIn: boolean

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
  
  // Set user from login flow
  setUserFromLogin: (user: UserWithRole) => void
  
  // Set logging in state
  setIsLoggingIn: (isLoggingIn: boolean) => void
}

const RoleContext = createContext<RoleContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  isLoggingIn: false,
  hasPermission: () => false,
  hasAllPermissions: () => false,
  hasAnyPermission: () => false,
  isRole: () => false,
  isAnyRole: () => false,
  isSuperAdmin: () => false,
  isHostAdmin: () => false,
  isHostMember: () => false,
  canAccessHostTools: () => false,
  refreshUser: async () => {},
  setUserFromLogin: () => {},
  setIsLoggingIn: () => {}
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
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false)

  const loadUser = async () => {
    try {
      setLoading(true)
      console.log("RoleContext: Starting to load user role...")
      
      const userWithRole = await getCurrentUserWithRole()
      
      if (userWithRole) {
        console.log("RoleContext: User role loaded successfully:", userWithRole.role)
        setUser(userWithRole)
        setIsAuthenticated(true)
      } else {
        console.log("RoleContext: No user role found")
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error("RoleContext: Error loading user with role:", error)
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      console.log("RoleContext: Setting loading to false - COMPLETE")
      setLoading(false)
    }
  }

  // Add a method to set user directly from login flow
  const setUserFromLogin = (userWithRole: UserWithRole) => {
    console.log("RoleContext: Setting user from login:", userWithRole.role)
    setUser(userWithRole)
    setIsAuthenticated(true)
    setLoading(false)
    setIsLoggingIn(false)
  }

  useEffect(() => {
    let mounted = true
    
    // Check initial session on mount
    const checkInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && mounted) {
        console.log("RoleContext: Initial session found, loading user")
        await loadUser()
      } else if (mounted) {
        console.log("RoleContext: No initial session")
        setLoading(false)
      }
    }
    
    checkInitialSession()

    // Listen for auth state changes - but DON'T reload on SIGNED_IN
    // The login flow will handle setting the user
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        
        console.log("RoleContext: Auth state changed:", event, !!session)

        if (event === "SIGNED_OUT" || !session) {
          setUser(null)
          setIsAuthenticated(false)
          setLoading(false)
        } else if (event === "SIGNED_IN" && session) {
          // DON'T load user here - let the login flow handle it
          console.log("RoleContext: SIGNED_IN event - waiting for login flow to complete")
          setIsAuthenticated(true)
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
  const isSuperAdmin = (): boolean => isRole(UserRole.ADMIN)
  const isHostAdmin = (): boolean => isRole(UserRole.ADMIN) || isRole(UserRole.STEERING) || isRole(UserRole.ADVISORY)
  const isHostMember = (): boolean => isRole(UserRole.HOST)

  const canAccessHostTools = (): boolean => {
    // All authenticated users with a role can access host tools
    return isAnyRole([
      UserRole.ADMIN,
      UserRole.STEERING,
      UserRole.ADVISORY,
      UserRole.HOST
    ])
  }

  const refreshUser = async (): Promise<void> => {
    await loadUser()
  }

  const contextValue: RoleContextType = {
    user,
    loading,
    isAuthenticated,
    isLoggingIn,
    hasPermission: checkPermission,
    hasAllPermissions: checkAllPermissions,
    hasAnyPermission: checkAnyPermission,
    isRole,
    isAnyRole,
    isSuperAdmin,
    isHostAdmin,
    isHostMember,
    canAccessHostTools,
    refreshUser,
    setUserFromLogin,
    setIsLoggingIn
  }

  return (
    <RoleContext.Provider value={contextValue}>{children}</RoleContext.Provider>
  )
}
