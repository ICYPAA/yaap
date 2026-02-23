"use client"

import { useToast } from "@/components/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toaster"
import {
  AlertCircle,
  CheckCircle,
  Edit,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
  X
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  deleteVolunteerNotification,
  getVolunteers,
  sendVolunteerNotifications,
  sendTestVolunteerNotification,
  updateVolunteerNotification,
  updateVolunteerStatus,
  type VolunteerNotification
} from "./actions"

type StatusFilter = "sent" | "not-sent" | "confirmed" | "not-confirmed"
type TypeFilter = string | null

interface FilterState {
  status: StatusFilter | null
  type: TypeFilter
  search: string
}

export default function VolunteerNotificationsPage() {
  const [notifications, setNotifications] = useState<VolunteerNotification[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNotifications, setSelectedNotifications] = useState<Set<number>>(new Set())
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [parsedVolunteers, setParsedVolunteers] = useState<any[]>([])
  const { toast: toastHook } = useToast()
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    status: null,
    type: null,
    search: ""
  })
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingNotification, setEditingNotification] = useState<VolunteerNotification | null>(null)
  const [isEditingVolunteer, setIsEditingVolunteer] = useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [deletingNotificationId, setDeletingNotificationId] = useState<number | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [detailsNotification, setDetailsNotification] = useState<VolunteerNotification | null>(null)

  // Calculate statistics
  const volunteerStats = useMemo(() => {
    const total = notifications.length
    const sent = notifications.filter((n) => n.notification_sent_at).length
    const confirmed = notifications.filter((n) => n.confirmed_at).length
    const pending = total - confirmed

    // Count by type
    const typeCount: Record<string, number> = {}
    notifications.forEach((n) => {
      typeCount[n.type] = (typeCount[n.type] || 0) + 1
    })

    return {
      total,
      sent,
      confirmed,
      pending,
      typeCount
    }
  }, [notifications])

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Filter out ic2025 type
      if (n.type === 'ic2025') return false
      
      // Apply status filter
      if (activeFilters.status) {
        switch (activeFilters.status) {
          case "sent":
            if (!n.notification_sent_at) return false
            break
          case "not-sent":
            if (n.notification_sent_at) return false
            break
          case "confirmed":
            if (!n.confirmed_at) return false
            break
          case "not-confirmed":
            if (n.confirmed_at) return false
            break
        }
      }

      // Apply type filter
      if (activeFilters.type) {
        if (n.type !== activeFilters.type) {
          return false
        }
      }

      // Apply search filter
      if (activeFilters.search) {
        const searchTerm = activeFilters.search.toLowerCase()
        const searchableFields = [
          n.name,
          n.type,
          n.contact_value,
          n.data ? JSON.stringify(n.data) : ""
        ].filter(Boolean)

        const matchesSearch = searchableFields.some((field) =>
          field?.toLowerCase().includes(searchTerm)
        )

        if (!matchesSearch) return false
      }

      return true
    })
  }, [notifications, activeFilters])

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    setIsLoading(true)
    try {
      const data = await getVolunteers()
      setNotifications(data)
    } catch (error) {
      console.error("Error loading notifications:", error)
      toast.error("Failed to load volunteer notifications")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    
    try {
      // Parse the file (placeholder - implement actual parsing logic based on file format)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          // For now, just parse as CSV - adjust based on actual format
          const text = e.target?.result as string
          const lines = text.split('\n').filter(line => line.trim())
          const headers = lines[0]?.split(',').map(h => h.trim())
          
          const parsed = lines.slice(1).map((line, index) => {
            const values = line.split(',').map(v => v.trim())
            return {
              id: `preview-${index}`,
              name: values[0] || '',
              email: values[1] || '',
              phone: values[2] || '',
              type: values[3] || 'general',
              notes: values[4] || ''
            }
          }).filter(v => v.name) // Filter out empty rows
          
          setParsedVolunteers(parsed)
          setShowUploadDialog(false)
          setShowPreviewDialog(true)
        } catch (parseError) {
          console.error("Error parsing file:", parseError)
          toast.error("Failed to parse file. Please check the format.")
        }
      }
      
      reader.readAsText(selectedFile)
    } catch (error) {
      console.error("Error uploading file:", error)
      toast.error("Failed to upload file")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSaveVolunteers = async () => {
    setIsUploading(true)
    try {
      // TODO: Implement saving parsed volunteers to database
      toast.success(`${parsedVolunteers.length} volunteers would be saved (implementation pending)`)
      setShowPreviewDialog(false)
      setParsedVolunteers([])
      setSelectedFile(null)
      loadNotifications()
    } catch (error) {
      toast.error("Failed to save volunteers")
    } finally {
      setIsUploading(false)
    }
  }

  const handleNotificationSelect = (notificationId: number, checked: boolean) => {
    const newSelected = new Set(selectedNotifications)
    if (checked) {
      newSelected.add(notificationId)
    } else {
      newSelected.delete(notificationId)
    }
    setSelectedNotifications(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const unsent = filteredNotifications
        .filter((n) => !n.notification_sent_at && !n.confirmed_at)
        .map((n) => n.id)
      setSelectedNotifications(new Set(unsent))
    } else {
      setSelectedNotifications(new Set())
    }
  }

  const handleSendNotifications = async () => {
    if (selectedNotifications.size === 0) {
      toastHook({
        title: "No notifications selected",
        description: "Please select at least one notification to send.",
        variant: "destructive"
      })
      return
    }

    try {
      const result = await sendVolunteerNotifications(Array.from(selectedNotifications))
      if (result.error) {
        toastHook({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        const successCount = result.results?.filter((r) => r.success).length || 0
        toastHook({
          title: "Success",
          description: `${successCount} notification(s) sent successfully`
        })
        setSelectedNotifications(new Set())
        loadNotifications()
      }
    } catch (error) {
      toastHook({
        title: "Error",
        description: "Failed to send notifications",
        variant: "destructive"
      })
    }
  }

  const handleStatusUpdate = async (notificationId: number, field: string, checked: boolean) => {
    try {
      const result = await updateVolunteerStatus(notificationId, field, checked)
      if (result.error) {
        toast.error(result.error)
        loadNotifications()
      } else {
        toast.success("Status updated successfully")
        loadNotifications()
      }
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
      loadNotifications()
    }
  }

  const handleEditVolunteer = async (formData: FormData) => {
    if (!editingNotification) return
    
    setIsEditingVolunteer(true)
    try {
      const result = await updateVolunteerNotification(editingNotification.id, formData)
      if (result.error) {
        toastHook({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toastHook({
          title: "Success",
          description: "Volunteer notification updated successfully"
        })
        setShowEditDialog(false)
        setEditingNotification(null)
        loadNotifications()
      }
    } catch (error) {
      toastHook({
        title: "Error",
        description: "Failed to update volunteer notification",
        variant: "destructive"
      })
    } finally {
      setIsEditingVolunteer(false)
    }
  }

  const confirmDelete = async () => {
    if (deletingNotificationId) {
      try {
        const result = await deleteVolunteerNotification(deletingNotificationId)
        if (result.success) {
          toast.success("Notification deleted successfully")
          loadNotifications()
        } else {
          toast.error(result.error || "Failed to delete notification")
        }
      } catch (error) {
        toast.error("Failed to delete notification")
      }
      setShowDeleteConfirmDialog(false)
      setDeletingNotificationId(null)
    }
  }

  const handleSendTestNotification = async (formData: FormData) => {
    const email = formData.get("email") as string
    
    if (!email) {
      toast.error("Email is required")
      return
    }

    try {
      const result = await sendTestVolunteerNotification(formData)
      if ('success' in result && result.success) {
        toast.success("Test notification sent successfully!")
        setShowTestDialog(false)
      } else {
        toast.error('error' in result ? result.error : "Failed to send test notification")
      }
    } catch (error) {
      toast.error("Failed to send test notification")
    }
  }

  const getUniqueTypes = useMemo(() => {
    const types = new Set(notifications.filter(n => n.type !== 'ic2025').map(n => n.type))
    return Array.from(types)
  }, [notifications])

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Volunteer Notifications</h1>
          <p className="text-muted-foreground">
            Manage volunteer notifications and track their status
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Send className="mr-2 h-4 w-4" />
                Test Notification
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Test Notification</DialogTitle>
                <DialogDescription>
                  Send a test volunteer notification to verify the system is working
                </DialogDescription>
              </DialogHeader>
              <form action={handleSendTestNotification} className="space-y-4">
                <div>
                  <Label htmlFor="test-email">Email</Label>
                  <Input
                    id="test-email"
                    name="email"
                    type="email"
                    placeholder="test@example.com"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTestDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Send Test</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Spreadsheet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Volunteer Spreadsheet</DialogTitle>
                <DialogDescription>
                  Upload a spreadsheet containing volunteer information (format TBD)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowUploadDialog(false)
                      setSelectedFile(null)
                    }}
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleFileUpload}
                    disabled={!selectedFile || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Uploading...
                      </>
                    ) : (
                      "Upload & Parse"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Volunteer Notifications ({filteredNotifications.length} of {notifications.length})
          </CardTitle>
          <CardDescription>
            Manage volunteer notifications and track their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Statistics Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {volunteerStats.total}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Volunteers
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {volunteerStats.sent}
              </div>
              <div className="text-sm text-muted-foreground">Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {volunteerStats.confirmed}
              </div>
              <div className="text-sm text-muted-foreground">Confirmed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {volunteerStats.pending}
              </div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>

          {/* Search Input */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search volunteers, types..."
                value={activeFilters.search}
                onChange={(e) =>
                  setActiveFilters((prev) => ({
                    ...prev,
                    search: e.target.value
                  }))
                }
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-muted-foreground self-center">
                Status:
              </span>
              <Button
                variant={activeFilters.status === null ? "secondary" : "outline"}
                onClick={() => setActiveFilters((prev) => ({ ...prev, status: null }))}
              >
                All ({notifications.length})
              </Button>
              <Button
                variant={activeFilters.status === "sent" ? "secondary" : "outline"}
                onClick={() => setActiveFilters((prev) => ({ ...prev, status: "sent" }))}
              >
                Sent
              </Button>
              <Button
                variant={activeFilters.status === "not-sent" ? "secondary" : "outline"}
                onClick={() => setActiveFilters((prev) => ({ ...prev, status: "not-sent" }))}
              >
                Not Sent
              </Button>
              <Button
                variant={activeFilters.status === "confirmed" ? "secondary" : "outline"}
                onClick={() => setActiveFilters((prev) => ({ ...prev, status: "confirmed" }))}
              >
                Confirmed
              </Button>
              <Button
                variant={activeFilters.status === "not-confirmed" ? "secondary" : "outline"}
                onClick={() => setActiveFilters((prev) => ({ ...prev, status: "not-confirmed" }))}
              >
                Not Confirmed
              </Button>
            </div>
          </div>

          {/* Type Filters */}
          {getUniqueTypes.length > 0 && (
            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-muted-foreground self-center">
                  Type:
                </span>
                <Button
                  variant={activeFilters.type === null ? "secondary" : "outline"}
                  onClick={() => setActiveFilters((prev) => ({ ...prev, type: null }))}
                >
                  All Types
                </Button>
                {getUniqueTypes.map((type) => (
                  <Button
                    key={type}
                    variant={activeFilters.type === type ? "secondary" : "outline"}
                    onClick={() => setActiveFilters((prev) => ({ ...prev, type }))}
                  >
                    {type} ({volunteerStats.typeCount[type] || 0})
                  </Button>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No notifications found for the current filter.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm font-medium">
                    Bulk Actions ({selectedNotifications.size} selected)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSendNotifications}
                      disabled={selectedNotifications.size === 0}
                      size="sm"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send Notifications
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap text-sm">
                  <span className="text-muted-foreground">Quick select:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedNotifications.size === filteredNotifications.filter(n => !n.notification_sent_at && !n.confirmed_at).length && selectedNotifications.size > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="select-none">
                      Unsent ({filteredNotifications.filter(n => !n.notification_sent_at && !n.confirmed_at).length})
                    </span>
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNotifications(new Set())}
                    className="h-7"
                  >
                    <X className="mr-2 h-3 w-3" />
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-center">Sent</TableHead>
                      <TableHead className="text-center">Confirmed</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotifications.map((notification) => (
                      <TableRow key={notification.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedNotifications.has(notification.id)}
                            onCheckedChange={(checked) =>
                              handleNotificationSelect(notification.id, checked as boolean)
                            }
                            disabled={!!notification.confirmed_at}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {notification.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {notification.last_initial}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{notification.type}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {notification.contact_type === "email" ? (
                              <Mail className="h-3 w-3" />
                            ) : (
                              <Phone className="h-3 w-3" />
                            )}
                            <span className="text-sm">
                              {notification.contact_value}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {notification.data && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDetailsNotification(notification)
                                setShowDetailsDialog(true)
                              }}
                              className="text-sm"
                            >
                              View Details
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={!!notification.notification_sent_at}
                              onCheckedChange={(checked) =>
                                handleStatusUpdate(
                                  notification.id,
                                  'notification_sent_at',
                                  checked as boolean
                                )
                              }
                              disabled={!!notification.confirmed_at}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Checkbox
                              checked={!!notification.confirmed_at}
                              onCheckedChange={(checked) =>
                                handleStatusUpdate(
                                  notification.id,
                                  'confirmed_at',
                                  checked as boolean
                                )
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingNotification(notification)
                                setShowEditDialog(true)
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDeletingNotificationId(notification.id)
                                setShowDeleteConfirmDialog(true)
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Volunteer Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Volunteer Notification</DialogTitle>
            <DialogDescription>
              Update the volunteer notification details
            </DialogDescription>
          </DialogHeader>
          {editingNotification && (
            <form action={handleEditVolunteer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={editingNotification.name}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-last_initial">Last Initial</Label>
                  <Input
                    id="edit-last_initial"
                    name="last_initial"
                    defaultValue={editingNotification.last_initial || ""}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-type">Type *</Label>
                <Input
                  id="edit-type"
                  name="type"
                  defaultValue={editingNotification.type}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-contact_type">Contact Type *</Label>
                  <select
                    id="edit-contact_type"
                    name="contact_type"
                    defaultValue={editingNotification.contact_type}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="edit-contact_value">Contact Info *</Label>
                  <Input
                    id="edit-contact_value"
                    name="contact_value"
                    defaultValue={editingNotification.contact_value}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingNotification(null)
                  }}
                  disabled={isEditingVolunteer}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditingVolunteer}>
                  {isEditingVolunteer ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    "Update Volunteer"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this volunteer notification? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirmDialog(false)
                setDeletingNotificationId(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Volunteer Details</DialogTitle>
            <DialogDescription>
              {detailsNotification?.name} - {detailsNotification?.type}
            </DialogDescription>
          </DialogHeader>
          {detailsNotification?.data && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-semibold mb-3">Volunteer Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(detailsNotification.data).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="font-medium text-muted-foreground">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div>
                        {Array.isArray(value) 
                          ? value.join(', ')
                          : typeof value === 'boolean' 
                          ? value ? 'Yes' : 'No'
                          : value?.toString() || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowDetailsDialog(false)
                setDetailsNotification(null)
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Volunteer Import</DialogTitle>
            <DialogDescription>
              Review the parsed volunteers before saving. {parsedVolunteers.length} volunteers found.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedVolunteers.map((volunteer) => (
                    <TableRow key={volunteer.id}>
                      <TableCell>{volunteer.name}</TableCell>
                      <TableCell>{volunteer.email || '-'}</TableCell>
                      <TableCell>{volunteer.phone || '-'}</TableCell>
                      <TableCell>{volunteer.type}</TableCell>
                      <TableCell>{volunteer.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreviewDialog(false)
                  setParsedVolunteers([])
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveVolunteers} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  `Save ${parsedVolunteers.length} Volunteers`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  )
}