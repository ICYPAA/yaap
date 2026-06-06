"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  MultiSelect,
  type MultiSelectOption
} from "@/components/ui/multi-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { AlertCircle, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { getUsersWithRoles, updateUserRole, type UserWithRole } from "./actions"

const AVAILABLE_PERMISSIONS = [
  "program:edit",
  "reminders:edit",
  "volunteering:sensitive",
  "volunteering:edit",
  "shift:edit"
] as const

const PERMISSION_OPTIONS: MultiSelectOption[] = AVAILABLE_PERMISSIONS.map(
  (permission) => ({
    value: permission,
    label: permission.replace(":", " ")
  })
)

type Permission = (typeof AVAILABLE_PERMISSIONS)[number]

export default function RoleManagementPage() {
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const result = await getUsersWithRoles()

      if (result.error) {
        setError(result.error)
        setHasAccess(false)
      } else {
        setUsers(result.users || [])
        setHasAccess(true)
      }
    } catch (err) {
      setError("Failed to load users")
      console.error("Error loading users:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (saving) return

    try {
      setSaving(userId)
      const result = await updateUserRole(
        userId,
        newRole as "host" | "steering",
        []
      )

      if (result.error) {
        setError(result.error)
      } else {
        // Update local state
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId
              ? {
                  ...user,
                  role: newRole as "admin" | "steering" | "host" | "volunteer",
                  permissions: []
                }
              : user
          )
        )
        setError(null)
      }
    } catch (err) {
      setError("Failed to update role")
      console.error("Error updating role:", err)
    } finally {
      setSaving(null)
    }
  }

  const handlePermissionChange = async (
    userId: string,
    permissions: Permission[]
  ) => {
    const user = users.find((u) => u.id === userId)
    if (!user || saving) return

    try {
      setSaving(userId)
      const result = await updateUserRole(
        userId,
        user.role as "host" | "steering",
        permissions
      )

      if (result.error) {
        setError(result.error)
      } else {
        // Update local state
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, permissions } : u))
        )
        setError(null)
      }
    } catch (err) {
      setError("Failed to update permissions")
      console.error("Error updating permissions:", err)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error ||
              "You don't have permission to access role management. Only admins and steering members can view this page."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions for Discord users
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Discord Users</CardTitle>
          <CardDescription>
            Users who have logged in via Discord. Admin roles can only be
            changed directly in the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No Discord users found
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 font-medium text-sm text-muted-foreground border-b pb-2">
                <div className="col-span-3">Discord Name</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-4">Permissions</div>
              </div>

              {/* User rows */}
              {users.map((user) => {
                const isAdmin = user.role === "admin"
                const isSteeringOrAdmin =
                  user.role === "admin" || user.role === "steering"
                const isSaving = saving === user.id
                return (
                  <div
                    key={user.id}
                    className={`grid grid-cols-12 gap-4 items-start py-3 border-b ${
                      isAdmin ? "bg-red-50 dark:bg-red-950/20" : ""
                    }`}
                  >
                    {/* Discord Name */}
                    <div className="col-span-3">
                      <div className="font-medium flex items-center gap-2">
                        {user.profile_name || user.email?.split('@')[0] || "Unknown User"}
                        {user.email === users[0]?.email && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </div>
                      {user.role === "admin" && (
                        <Badge variant="destructive" className="text-xs mt-1">
                          Admin
                        </Badge>
                      )}
                      {!user.role && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          No Role
                        </Badge>
                      )}
                    </div>

                    {/* Email */}
                    <div className="col-span-3">
                      <div className="text-sm break-all">{user.email}</div>
                    </div>

                    {/* Role Dropdown */}
                    <div className="col-span-2">
                      {isAdmin ? (
                        <div className="space-y-1">
                          <Badge variant="destructive" className="text-xs">
                            Admin
                          </Badge>
                          <p className="text-xs text-muted-foreground">Database only</p>
                        </div>
                      ) : (
                        <Select
                          value={user.role || "none"}
                          onValueChange={(value) => {
                            if (value !== "none") {
                              handleRoleChange(user.id, value)
                            }
                          }}
                          disabled={isSaving}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Role</SelectItem>
                            <SelectItem value="host">Host</SelectItem>
                            <SelectItem value="steering">Steering</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Permissions */}
                    <div className="col-span-4">
                      {!user.role ? (
                        <div className="text-sm text-muted-foreground">
                          Select a role first
                        </div>
                      ) : isSteeringOrAdmin ? (
                        <div className="text-sm text-muted-foreground">
                          All permissions (role-based)
                        </div>
                      ) : (
                        <MultiSelect
                          options={PERMISSION_OPTIONS}
                          value={user.permissions}
                          onChange={(newPermissions) =>
                            handlePermissionChange(
                              user.id,
                              newPermissions as Permission[]
                            )
                          }
                          placeholder="Select permissions..."
                          disabled={isSaving}
                          className="text-xs"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Admin</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• All permissions automatically</li>
                <li>• Cannot be edited via UI</li>
                <li>• Must be set in database</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Steering</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• All permissions automatically</li>
                <li>• Can manage other roles</li>
                <li>• Full system access</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Host</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Custom permissions only</li>
                <li>• Limited system access</li>
                <li>• Task-specific roles</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
