import React from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { useFeatures } from "../context/FeatureContext"
import { useRole } from "../context/RoleContext"
import { useTheme } from "../context/ThemeContext"
import { Permission, UserRole } from "../lib/roleChecker"

type FeatureFlag = keyof typeof import("../context/FeatureContext")["useFeatures"] extends () => { features: infer T } ? T : never

interface ProtectedComponentProps {
  children: React.ReactNode
  requiredPermissions?: Permission[]
  requiredRoles?: UserRole[]
  requiredFeatures?: (keyof {
    child_care_enabled: boolean
    volunteering_enabled: boolean
    hospitality_enabled: boolean
    accessibility_enabled: boolean
    support_chat_enabled: boolean
    bid_schedule_enabled: boolean
    schedule_sharing_enabled: boolean
    push_notifications_enabled: boolean
  })[]
  requireAll?: boolean // If true, user must have ALL permissions/roles/features. If false, user needs ANY
  fallbackComponent?: React.ReactNode
  loadingComponent?: React.ReactNode
}

/**
 * Higher-order component that protects content based on user roles, permissions, and feature flags
 *
 * @param children - The content to protect
 * @param requiredPermissions - Array of permissions required to view content
 * @param requiredRoles - Array of roles required to view content
 * @param requiredFeatures - Array of feature flags required to view content
 * @param requireAll - If true, user must have ALL permissions/roles/features. If false, user needs ANY (default: false)
 * @param fallbackComponent - Component to show when user doesn't have access
 * @param loadingComponent - Component to show while checking permissions
 */
export const ProtectedComponent: React.FC<ProtectedComponentProps> = ({
  children,
  requiredPermissions = [],
  requiredRoles = [],
  requiredFeatures = [],
  requireAll = false,
  fallbackComponent,
  loadingComponent
}) => {
  const { theme } = useTheme()
  const {
    loading: roleLoading,
    isAuthenticated,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    isRole,
    isAnyRole
  } = useRole()
  const { loading: featureLoading, isFeatureEnabled } = useFeatures()

  const styles = createStyles(theme)

  // Show loading component while checking permissions or features
  if (roleLoading || featureLoading) {
    return (
      loadingComponent || (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )
    )
  }

  // If not authenticated, show fallback
  if (!isAuthenticated) {
    return (
      fallbackComponent || (
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackTitle}>Authentication Required</Text>
          <Text style={styles.fallbackText}>
            Please log in to access this content.
          </Text>
        </View>
      )
    )
  }

  // Check permissions
  let hasRequiredPermissions = true
  if (requiredPermissions.length > 0) {
    if (requireAll) {
      hasRequiredPermissions = hasAllPermissions(requiredPermissions)
    } else {
      hasRequiredPermissions = hasAnyPermission(requiredPermissions)
    }
  }

  // Check roles
  let hasRequiredRoles = true
  if (requiredRoles.length > 0) {
    if (requireAll) {
      hasRequiredRoles = requiredRoles.every((role) => isRole(role))
    } else {
      hasRequiredRoles = isAnyRole(requiredRoles)
    }
  }

  // Check features
  let hasRequiredFeatures = true
  if (requiredFeatures.length > 0) {
    if (requireAll) {
      hasRequiredFeatures = requiredFeatures.every((feature) => isFeatureEnabled(feature))
    } else {
      hasRequiredFeatures = requiredFeatures.some((feature) => isFeatureEnabled(feature))
    }
  }

  // If user doesn't have required permissions, roles, or features, show fallback
  if (!hasRequiredPermissions || !hasRequiredRoles || !hasRequiredFeatures) {
    return (
      fallbackComponent || (
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackTitle}>Content Not Available</Text>
          <Text style={styles.fallbackText}>
            This content is not available due to permissions or feature settings.
          </Text>
        </View>
      )
    )
  }

  // User has access, render children
  return <>{children}</>
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing.sm
    },
    fallbackContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.background
    },
    fallbackTitle: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      textAlign: "center",
      marginBottom: theme.spacing.md
    },
    fallbackText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center",
      lineHeight: 20
    }
  })

// Higher-order component wrapper for easier usage
export const withPermissions = (
  requiredPermissions: Permission[] = [],
  requiredRoles: UserRole[] = [],
  requireAll: boolean = false
) => {
  return <P extends object>(Component: React.ComponentType<P>) => {
    return (props: P) => (
      <ProtectedComponent
        requiredPermissions={requiredPermissions}
        requiredRoles={requiredRoles}
        requireAll={requireAll}
      >
        <Component {...props} />
      </ProtectedComponent>
    )
  }
}

// Higher-order component wrapper for feature-based protection
export const withFeatures = (
  requiredFeatures: (keyof {
    child_care_enabled: boolean
    volunteering_enabled: boolean
    hospitality_enabled: boolean
    accessibility_enabled: boolean
    support_chat_enabled: boolean
    bid_schedule_enabled: boolean
    schedule_sharing_enabled: boolean
    push_notifications_enabled: boolean
  })[] = [],
  requireAll: boolean = false
) => {
  return <P extends object>(Component: React.ComponentType<P>) => {
    return (props: P) => (
      <ProtectedComponent
        requiredFeatures={requiredFeatures}
        requireAll={requireAll}
      >
        <Component {...props} />
      </ProtectedComponent>
    )
  }
}
