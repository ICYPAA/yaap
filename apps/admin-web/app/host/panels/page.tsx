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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { validatePanelData, type ParsedPanel } from "@/utils/xlsx-panel-parser"
import {
  AlertCircle,
  ArrowRight,
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
  classifyPanelsFromXLSX,
  createSinglePanel,
  deletePanelNotification,
  getPanels,
  getTestNotificationPreview,
  saveClassifiedPanels,
  sendPanelNotifications,
  sendPanelReminders,
  sendTestNotification,
  updateNotificationStatus,
  updatePanelNotification,
  type NewPanelistEntry,
  type PanelNotification
} from "./actions"

type StatusFilter =
  | "sent"
  | "not-sent"
  | "confirmed"
  | "not-confirmed"
  | "withdrawn"
  | "not-withdrawn"
type DayFilter = "Thursday" | "Friday" | "Saturday" | "Sunday"

interface FilterState {
  status: StatusFilter | null
  day: DayFilter | null
  search: string
}

interface UpdatedPanel {
  existing: PanelNotification
  newData: ParsedPanel
}

export default function PanelsPage() {
  const [notifications, setNotifications] = useState<PanelNotification[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [newPanels, setNewPanels] = useState<ParsedPanel[]>([])
  const [updatedPanels, setUpdatedPanels] = useState<UpdatedPanel[]>([])
  const [newPanelists, setNewPanelists] = useState<NewPanelistEntry[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedNotifications, setSelectedNotifications] = useState<
    Set<number>
  >(new Set())
  const [selectionMode, setSelectionMode] = useState<'unsent' | 'needsReminder1' | null>(null)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewContent, setPreviewContent] = useState<string>("")
  const [previewEmail, setPreviewEmail] = useState<string>("")
  const [previewPhone, setPreviewPhone] = useState<string>("")
  const { toast: toastHook } = useToast()
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    status: null,
    day: null,
    search: ""
  })
  const [showCreatePanelDialog, setShowCreatePanelDialog] = useState(false)
  const [isCreatingPanel, setIsCreatingPanel] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingNotification, setEditingNotification] = useState<PanelNotification | null>(null)
  const [isEditingPanel, setIsEditingPanel] = useState(false)
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [deletingNotificationId, setDeletingNotificationId] = useState<number | null>(null)

  // Calculate statistics
  const panelStats = useMemo(() => {
    const total = notifications.length
    const sent = notifications.filter((n) => n.notification_sent_at).length
    const confirmed = notifications.filter((n) => n.confirmed_at).length
    const withdrawn = notifications.filter((n) => n.denied_at).length
    const pending = total - confirmed - withdrawn

    return {
      total,
      sent,
      confirmed,
      withdrawn,
      pending
    }
  }, [notifications])

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
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
          case "withdrawn":
            if (!n.denied_at) return false
            break
          case "not-withdrawn":
            if (n.denied_at) return false
            break
        }
      }

      // Apply day filter
      if (activeFilters.day) {
        const dayLower = activeFilters.day.toLowerCase()
        if (!n.time_day.toLowerCase().includes(dayLower)) {
          return false
        }
      }

      // Apply search filter
      if (activeFilters.search) {
        const searchTerm = activeFilters.search.toLowerCase()
        const searchableFields = [
          n.title,
          n.panelist_name,
          n.room,
          n.time_day,
          n.topic,
          n.description,
          n.panelist_contact,
          n.literature_reference
        ].filter(Boolean) // Remove null/undefined values

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
      const data = await getPanels()
      setNotifications(data)
    } catch (error) {
      console.error("Error loading notifications:", error)
      toast("Error loading notifications", {
        description: "Failed to load panel notifications from database"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setNewPanels([])
      setUpdatedPanels([])
      setNewPanelists([])
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append("panels-file", selectedFile)

    try {
      const result = await classifyPanelsFromXLSX(formData)

      if (result.error) {
        toast("Error classifying panels", { description: result.error })
        return
      }

      setNewPanels(result.newPanels || [])
      setUpdatedPanels(result.updatedPanels || [])
      setNewPanelists(result.newPanelists || [])

      const newPanelsCount = result.newPanels?.length || 0
      const updatedPanelsCount = result.updatedPanels?.length || 0
      const newPanelistsCount = result.newPanelists?.length || 0

      let description = `Found ${newPanelsCount} new panels`
      if (updatedPanelsCount > 0) {
        description += `, ${updatedPanelsCount} panels to be updated`
      }
      if (newPanelistsCount > 0) {
        description += `, and ${newPanelistsCount} new panelists to add to existing panels`
      }
      description += "."

      toast("File parsed and classified", { description })
    } catch (error) {
      console.error("Error classifying file:", error)
      toast("Error classifying file", {
        description: "An unexpected error occurred."
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleSavePanels = async () => {
    if (
      newPanels.length === 0 &&
      updatedPanels.length === 0 &&
      newPanelists.length === 0
    ) {
      toast("No panels to save", {
        description:
          "There are no new panels, panel updates, or new panelists to save."
      })
      return
    }

    setIsUploading(true)
    try {
      const result = await saveClassifiedPanels(
        newPanels,
        updatedPanels,
        newPanelists
      )

      if (result.error) {
        toast("Error saving panels", {
          description: `${result.error} ${result.details ? JSON.stringify(result.details) : ""}`
        })
      } else {
        toast("Panels saved successfully", { description: result.success })
        loadNotifications()
        setSelectedFile(null)
        setNewPanels([])
        setUpdatedPanels([])
        setNewPanelists([])
      }
    } catch (error) {
      console.error("Error saving panels:", error)
      toast("Error saving panels", { description: "Failed to save panels" })
    } finally {
      setIsUploading(false)
    }
  }

  const handleNotificationSelect = (
    notificationId: number,
    checked: boolean
  ) => {
    const newSelected = new Set(selectedNotifications)
    if (checked) {
      newSelected.add(notificationId)
    } else {
      newSelected.delete(notificationId)
    }
    setSelectedNotifications(newSelected)
    
    // Clear selection mode if manually selecting/deselecting
    if (newSelected.size === 0) {
      setSelectionMode(null)
    }
  }

  const handleSelectAll = (checked: boolean, filterType: 'unsent' | 'needsReminder1') => {
    if (checked) {
      let filtered: number[] = []
      
      if (filterType === 'unsent') {
        // Only select visible notifications that haven't been sent yet (excluding confirmed/withdrawn)
        filtered = filteredNotifications
          .filter((n) => !n.notification_sent_at && !n.confirmed_at && !n.denied_at)
          .map((n) => n.id)
      } else if (filterType === 'needsReminder1') {
        // Select notifications that have been sent but no first reminder (excluding confirmed/withdrawn)
        filtered = filteredNotifications
          .filter((n) => n.notification_sent_at && !n.reminder_followup_sent_at && !n.confirmed_at && !n.denied_at)
          .map((n) => n.id)
      }
      
      setSelectedNotifications(new Set(filtered))
      setSelectionMode(filterType as 'unsent' | 'needsReminder1')
    } else {
      setSelectedNotifications(new Set())
      setSelectionMode(null)
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
      const result = await sendPanelNotifications(
        Array.from(selectedNotifications)
      )
      if (result.error) {
        toastHook({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        const successCount =
          result.results?.filter((r) => r.success).length || 0
        toastHook({
          title: "Success",
          description: `${successCount} notification(s) sent successfully`
        })
        setSelectedNotifications(new Set())
        loadNotifications() // Refresh the list
      }
    } catch (error) {
      toastHook({
        title: "Error",
        description: "Failed to send notifications",
        variant: "destructive"
      })
    }
  }

  const handleSendBulkReminders = async (isSecondReminder: boolean = false) => {
    if (selectedNotifications.size === 0) {
      toastHook({
        title: "No notifications selected",
        description: `Please select at least one notification to send ${isSecondReminder ? 'second ' : ''}reminders.`,
        variant: "destructive"
      })
      return
    }

    try {
      const result = await sendPanelReminders(
        Array.from(selectedNotifications),
        isSecondReminder
      )
      if (result.error) {
        toastHook({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        const successCount =
          result.results?.filter((r) => r.success).length || 0
        toastHook({
          title: "Success",
          description: `${successCount} ${isSecondReminder ? 'second ' : ''}reminder(s) sent successfully`
        })
        setSelectedNotifications(new Set())
        loadNotifications() // Refresh the list
      }
    } catch (error) {
      toastHook({
        title: "Error",
        description: `Failed to send ${isSecondReminder ? 'second ' : ''}reminders`,
        variant: "destructive"
      })
    }
  }

  const handleCreatePanel = async (formData: FormData) => {
    setIsCreatingPanel(true)
    try {
      const result = await createSinglePanel(formData)
      if (result.error) {
        toastHook({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toastHook({
          title: "Success",
          description: "Panel notification created successfully"
        })
        setShowCreatePanelDialog(false)
        loadNotifications() // Refresh the list
      }
    } catch (error) {
      toastHook({
        title: "Error",
        description: "Failed to create panel notification",
        variant: "destructive"
      })
    } finally {
      setIsCreatingPanel(false)
    }
  }

  const handleStatusUpdate = async (
    notificationId: number,
    field: string,
    checked: boolean
  ) => {
    try {
      const result = await updateNotificationStatus(notificationId, field, checked)
      if (result.error) {
        toast.error(result.error)
        // Refresh to revert UI state on error
        loadNotifications()
      } else {
        toast.success("Status updated successfully")
        loadNotifications() // Refresh the list
      }
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
      // Refresh to revert UI state on error
      loadNotifications()
    }
  }


  const sendNotification = async (notificationId: number, reminderType: 'initial' | 'reminder1' = 'initial') => {
    try {
      let result
      if (reminderType === 'initial') {
        result = await sendPanelNotifications([notificationId])
      } else if (reminderType === 'reminder1') {
        result = await sendPanelReminders([notificationId], false)
      } else {
        result = await sendPanelReminders([notificationId], true)
      }
        
      if (result.success) {
        const successCount =
          result.results?.filter((r) => r.success).length || 0
        const failureCount =
          result.results?.filter((r) => !r.success).length || 0

        if (successCount > 0) {
          const messageType = reminderType === 'initial' ? 'Notification' : 
                             reminderType === 'reminder1' ? 'First reminder' : 'Second reminder'
          toast.success(`${messageType} sent successfully`)
        }
        if (failureCount > 0) {
          const messageType = reminderType === 'initial' ? 'notification(s)' : 'reminder(s)'
          toast.error(`Failed to send ${failureCount} ${messageType}`)
        }

        loadNotifications()
      } else {
        const messageType = reminderType === 'initial' ? 'notification' : 'reminder'
        toast.error(result.error || `Failed to send ${messageType}`)
      }
    } catch (error) {
      const messageType = reminderType === 'initial' ? 'notification' : 'reminder'
      toast.error(`Failed to send ${messageType}`)
    }
  }

  const deleteNotification = async (notificationId: number) => {
    try {
      const result = await deletePanelNotification(notificationId)
      if (result.success) {
        toast.success("Notification deleted successfully")
        loadNotifications()
      } else {
        toast.error(result.error || "Failed to delete notification")
      }
    } catch (error) {
      toast.error("Failed to delete notification")
    }
  }

  const handleEditPanel = async (formData: FormData) => {
    if (!editingNotification) return
    
    setIsEditingPanel(true)
    try {
      const result = await updatePanelNotification(editingNotification.id, formData)
      if (result.error) {
        toastHook({
          title: "Error",
          description: result.error,
          variant: "destructive"
        })
      } else {
        toastHook({
          title: "Success",
          description: "Panel notification updated successfully"
        })
        setShowEditDialog(false)
        setEditingNotification(null)
        loadNotifications() // Refresh the list
      }
    } catch (error) {
      toastHook({
        title: "Error",
        description: "Failed to update panel notification",
        variant: "destructive"
      })
    } finally {
      setIsEditingPanel(false)
    }
  }

  const confirmDelete = async () => {
    if (deletingNotificationId) {
      await deleteNotification(deletingNotificationId)
      setShowDeleteConfirmDialog(false)
      setDeletingNotificationId(null)
    }
  }

  const handleShowTestPreview = async (formData: FormData) => {
    const email = formData.get("email") as string
    const phone = formData.get("phone") as string

    if (!email && !phone) {
      toast.error("Either email or phone is required")
      return
    }

    try {
      const result = await getTestNotificationPreview(formData)
      if (result.success && result.content) {
        setPreviewContent(result.content)
        setPreviewEmail(email)
        setPreviewPhone(phone)
        setShowPreviewDialog(true)
        setShowTestDialog(false)
      } else {
        toast.error(result.error || "Failed to generate preview")
      }
    } catch (error) {
      toast.error("An unexpected error occurred.")
    }
  }

  const handleSendTestNotification = async () => {
    const formData = new FormData()
    if (previewEmail) formData.append("email", previewEmail)
    if (previewPhone) formData.append("phone", previewPhone)

    try {
      const result = await sendTestNotification(formData)
      if (result.success) {
        toast.success("Test notification sent successfully!")
        setShowPreviewDialog(false)
      } else {
        toast.error(result.error || "Failed to send test notification")
      }
    } catch (error) {
      toast.error("Failed to send test notification")
    }
  }

  const getPanelValidationErrors = (panel: ParsedPanel): string[] => {
    return validatePanelData(panel)
  }

  const hasValidationErrors = (panel: ParsedPanel): boolean => {
    return getPanelValidationErrors(panel).length > 0
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Panel Management</h1>
          <p className="text-muted-foreground">
            Manage conference panels and notify panelists
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
                  Send a test panel notification to verify the system is working
                </DialogDescription>
              </DialogHeader>
              <form action={handleShowTestPreview} className="space-y-4">
                <div>
                  <Label htmlFor="test-email">Email (optional)</Label>
                  <Input
                    id="test-email"
                    name="email"
                    type="email"
                    placeholder="test@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="test-phone">Phone (optional)</Label>
                  <Input
                    id="test-phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
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
                  <Button type="submit">Preview Content</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload & Parse</TabsTrigger>
          <TabsTrigger value="manage">Manage Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Panel Data
              </CardTitle>
              <CardDescription>
                Upload an Excel file containing panel information. The file
                should have a &quot;Panels&quot; sheet with the specified format.
                Duplicate combinations of panel title + panelist contact will be
                skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
                <Button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isUploading}
                  className="flex items-center gap-2"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Parse & Classify
                </Button>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium">Create Individual Panel</h4>
                    <p className="text-sm text-muted-foreground">
                      Create a single panel notification manually
                    </p>
                  </div>
                  <Dialog
                    open={showCreatePanelDialog}
                    onOpenChange={setShowCreatePanelDialog}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create Panel
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create Panel Notification</DialogTitle>
                        <DialogDescription>
                          Create a notification for a single panelist
                        </DialogDescription>
                      </DialogHeader>
                      <form action={handleCreatePanel} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="time_day">Day & Time *</Label>
                            <Input
                              id="time_day"
                              name="time_day"
                              placeholder="Saturday 2:00 PM"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="room">Room *</Label>
                            <Input
                              id="room"
                              name="room"
                              placeholder="Room 101"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="title">Panel Title *</Label>
                          <Input
                            id="title"
                            name="title"
                            placeholder="Communication Workshop"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="topic">Topic</Label>
                          <Input
                            id="topic"
                            name="topic"
                            placeholder="Effective Communication in Recovery"
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Input
                            id="description"
                            name="description"
                            placeholder="Brief description of the panel"
                          />
                        </div>
                        <div>
                          <Label htmlFor="literature_reference">
                            Literature Reference
                          </Label>
                          <Input
                            id="literature_reference"
                            name="literature_reference"
                            placeholder="Big Book Chapter 5"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="panelist_name">
                              Panelist Name *
                            </Label>
                            <Input
                              id="panelist_name"
                              name="panelist_name"
                              placeholder="John D."
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="contact_type">Contact Type *</Label>
                            <select
                              id="contact_type"
                              name="contact_type"
                              required
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">Select type</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="panelist_contact">
                            Contact Info *
                          </Label>
                          <Input
                            id="panelist_contact"
                            name="panelist_contact"
                            placeholder="john@example.com or +1 (555) 123-4567"
                            required
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowCreatePanelDialog(false)}
                            disabled={isCreatingPanel}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isCreatingPanel}>
                            {isCreatingPanel ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Creating...
                              </>
                            ) : (
                              "Create Panel"
                            )}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {(newPanels.length > 0 ||
                updatedPanels.length > 0 ||
                newPanelists.length > 0) && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Classification Results
                    </h3>
                    <Button onClick={handleSavePanels} disabled={isUploading}>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Save to Database
                    </Button>
                  </div>

                  {/* Updated Panels */}
                  {updatedPanels.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-md font-semibold">
                        Panels to be Updated ({updatedPanels.length})
                      </h4>
                      <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Panel Title</TableHead>
                              <TableHead>Panelist</TableHead>
                              <TableHead>Field</TableHead>
                              <TableHead>Old Value</TableHead>
                              <TableHead>New Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {updatedPanels.map(({ existing, newData }) => (
                              <>
                                {existing.time_day !== newData.timeDay && (
                                  <TableRow key={`${existing.id}-time`}>
                                    <TableCell>{existing.title}</TableCell>
                                    <TableCell>
                                      {existing.panelist_name}
                                    </TableCell>
                                    <TableCell>Time/Day</TableCell>
                                    <TableCell>{existing.time_day}</TableCell>
                                    <TableCell className="flex items-center gap-2">
                                      <ArrowRight className="h-4 w-4" />
                                      {newData.timeDay}
                                    </TableCell>
                                  </TableRow>
                                )}
                                {existing.room !== newData.room && (
                                  <TableRow key={`${existing.id}-room`}>
                                    <TableCell>{existing.title}</TableCell>
                                    <TableCell>
                                      {existing.panelist_name}
                                    </TableCell>
                                    <TableCell>Room</TableCell>
                                    <TableCell>{existing.room}</TableCell>
                                    <TableCell className="flex items-center gap-2">
                                      <ArrowRight className="h-4 w-4" />
                                      {newData.room}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* New Panelists for Existing Panels */}
                  {newPanelists.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-md font-semibold">
                        New Panelists to be Added ({newPanelists.length})
                      </h4>
                      <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Panel Title</TableHead>
                              <TableHead>Time/Day</TableHead>
                              <TableHead>Room</TableHead>
                              <TableHead>New Panelist</TableHead>
                              <TableHead>Contact</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {newPanelists.map(({ panel, panelist }, index) => (
                              <TableRow key={index}>
                                <TableCell>{panel.title}</TableCell>
                                <TableCell>{panel.timeDay}</TableCell>
                                <TableCell>{panel.room}</TableCell>
                                <TableCell className="font-medium">
                                  {panelist.name}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {panelist.email ? (
                                      <>
                                        <Mail className="h-3 w-3" />
                                        <span className="text-sm">
                                          {panelist.email}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Phone className="h-3 w-3" />
                                        <span className="text-sm">
                                          {panelist.phone}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* New Panels */}
                  {newPanels.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-md font-semibold">
                        New Panels to be Created ({newPanels.length})
                      </h4>
                      <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Status</TableHead>
                              <TableHead>Time/Day</TableHead>
                              <TableHead>Room</TableHead>
                              <TableHead>Title</TableHead>
                              <TableHead>Panelists</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {newPanels.map((panel, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  {hasValidationErrors(panel) ? (
                                    <div className="flex items-center gap-2 text-red-500">
                                      <AlertCircle className="h-4 w-4" />
                                      <span className="text-xs">Errors</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-green-500">
                                      <CheckCircle className="h-4 w-4" />
                                      <span className="text-xs">Valid</span>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>{panel.timeDay}</TableCell>
                                <TableCell>{panel.room}</TableCell>
                                <TableCell>{panel.title}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {panel.panelists.map((panelist, pIndex) => (
                                      <div key={pIndex} className="text-sm">
                                        <span className="font-medium">
                                          {panelist.name}
                                        </span>
                                        {panelist.email && (
                                          <span className="text-muted-foreground ml-1">
                                            ({panelist.email})
                                          </span>
                                        )}
                                        {panelist.phone && (
                                          <span className="text-muted-foreground ml-1">
                                            ({panelist.phone})
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Panel Notifications ({filteredNotifications.length} of{" "}
                {notifications.length})
              </CardTitle>
              <CardDescription>
                Manage panel notifications and track their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Statistics Overview */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {panelStats.total}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Panels
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {panelStats.sent}
                  </div>
                  <div className="text-sm text-muted-foreground">Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {panelStats.confirmed}
                  </div>
                  <div className="text-sm text-muted-foreground">Confirmed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {panelStats.withdrawn}
                  </div>
                  <div className="text-sm text-muted-foreground">Withdrawn</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {panelStats.pending}
                  </div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>

              {/* Search Input */}
              <div className="mb-6">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search panels, panelists, rooms..."
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

              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-muted-foreground self-center">
                    Status:
                  </span>
                  <Button
                    variant={
                      activeFilters.status === null ? "secondary" : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({ ...prev, status: null }))
                    }
                  >
                    All ({notifications.length})
                  </Button>
                  <Button
                    variant={
                      activeFilters.status === "sent" ? "secondary" : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({ ...prev, status: "sent" }))
                    }
                  >
                    Sent
                  </Button>
                  <Button
                    variant={
                      activeFilters.status === "not-sent"
                        ? "secondary"
                        : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({
                        ...prev,
                        status: "not-sent"
                      }))
                    }
                  >
                    Not Sent
                  </Button>
                  <Button
                    variant={
                      activeFilters.status === "confirmed"
                        ? "secondary"
                        : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({
                        ...prev,
                        status: "confirmed"
                      }))
                    }
                  >
                    Confirmed
                  </Button>
                  <Button
                    variant={
                      activeFilters.status === "not-confirmed"
                        ? "secondary"
                        : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({
                        ...prev,
                        status: "not-confirmed"
                      }))
                    }
                  >
                    Not Confirmed
                  </Button>
                  <Button
                    variant={
                      activeFilters.status === "withdrawn"
                        ? "secondary"
                        : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({
                        ...prev,
                        status: "withdrawn"
                      }))
                    }
                  >
                    Withdrawn
                  </Button>
                  <Button
                    variant={
                      activeFilters.status === "not-withdrawn"
                        ? "secondary"
                        : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({
                        ...prev,
                        status: "not-withdrawn"
                      }))
                    }
                  >
                    Not Withdrawn
                  </Button>
                  {(activeFilters.status ||
                    activeFilters.day ||
                    activeFilters.search) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setActiveFilters({
                          status: null,
                          day: null,
                          search: ""
                        })
                      }
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-muted-foreground self-center">
                    Day:
                  </span>
                  <Button
                    variant={
                      activeFilters.day === null ? "secondary" : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({ ...prev, day: null }))
                    }
                  >
                    All Days
                  </Button>
                  <Button
                    variant={
                      activeFilters.day === "Thursday" ? "secondary" : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({ ...prev, day: "Thursday" }))
                    }
                  >
                    Thursday
                  </Button>
                  <Button
                    variant={
                      activeFilters.day === "Friday" ? "secondary" : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({ ...prev, day: "Friday" }))
                    }
                  >
                    Friday
                  </Button>
                  <Button
                    variant={
                      activeFilters.day === "Saturday" ? "secondary" : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({ ...prev, day: "Saturday" }))
                    }
                  >
                    Saturday
                  </Button>
                  <Button
                    variant={
                      activeFilters.day === "Sunday" ? "secondary" : "outline"
                    }
                    onClick={() =>
                      setActiveFilters((prev) => ({ ...prev, day: "Sunday" }))
                    }
                  >
                    Sunday
                  </Button>
                </div>
              </div>

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
                          disabled={selectionMode !== 'unsent' || selectedNotifications.size === 0}
                          size="sm"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Send Initial
                        </Button>
                        <Button
                          onClick={() => handleSendBulkReminders(false)}
                          disabled={selectionMode !== 'needsReminder1' || selectedNotifications.size === 0}
                          variant="outline"
                          size="sm"
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Send Reminder 1
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-wrap text-sm">
                      <span className="text-muted-foreground">Quick select:</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectionMode === 'unsent'}
                          onCheckedChange={(checked) => {
                            handleSelectAll(!!checked, 'unsent')
                          }}
                        />
                        <span onClick={() => handleSelectAll(selectionMode !== 'unsent', 'unsent')} className="select-none">
                          Unsent ({filteredNotifications.filter(n => !n.notification_sent_at && !n.confirmed_at && !n.denied_at).length})
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectionMode === 'needsReminder1'}
                          onCheckedChange={(checked) => {
                            handleSelectAll(!!checked, 'needsReminder1')
                          }}
                        />
                        <span onClick={() => handleSelectAll(selectionMode !== 'needsReminder1', 'needsReminder1')} className="select-none">
                          Needs Reminder 1 ({filteredNotifications.filter(n => n.notification_sent_at && !n.reminder_followup_sent_at && !n.confirmed_at && !n.denied_at).length})
                        </span>
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectAll(false, 'unsent')}
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
                          <TableHead>Panel</TableHead>
                          <TableHead>Panelist</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead className="text-center">Sent ✓</TableHead>
                          <TableHead className="text-center">Confirmed / Withdrawn</TableHead>
                          <TableHead className="text-center">Reminder 1 ✓</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center">
                              <Loader2 className="h-8 w-8 animate-spin mx-auto my-4" />
                              <p>Loading notifications...</p>
                            </TableCell>
                          </TableRow>
                        ) : filteredNotifications.length > 0 ? (
                          filteredNotifications.map((notification) => (
                            <TableRow key={notification.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedNotifications.has(
                                    notification.id
                                  )}
                                  onCheckedChange={(checked) =>
                                    handleNotificationSelect(
                                      notification.id,
                                      checked as boolean
                                    )
                                  }
                                  disabled={(() => {
                                    // Always disable for confirmed or withdrawn
                                    if (notification.confirmed_at || notification.denied_at) return true
                                    
                                    // Disable if a selection mode is active and this notification doesn't match
                                    if (!selectionMode) return false
                                    if (selectionMode === 'unsent' && notification.notification_sent_at) return true
                                    if (selectionMode === 'needsReminder1' && (!notification.notification_sent_at || notification.reminder_followup_sent_at)) return true
                                    return false
                                  })()}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {notification.title}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {notification.time_day} •{" "}
                                    {notification.room}
                                  </div>
                                  {notification.topic && (
                                    <div className="text-xs text-muted-foreground">
                                      {notification.topic}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">
                                  {notification.panelist_name}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {notification.contact_type === "email" ? (
                                    <Mail className="h-3 w-3" />
                                  ) : (
                                    <Phone className="h-3 w-3" />
                                  )}
                                  <span className="text-sm">
                                    {notification.panelist_contact}
                                  </span>
                                </div>
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
                                    disabled={!!notification.confirmed_at || !!notification.denied_at}
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center gap-3">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1">
                                          <Checkbox
                                            checked={!!notification.confirmed_at}
                                            onCheckedChange={(checked) =>
                                              handleStatusUpdate(
                                                notification.id,
                                                'confirmed_at',
                                                checked as boolean
                                              )
                                            }
                                            className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                          />
                                          <span className="text-xs text-green-600">✓</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Mark as confirmed</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1">
                                          <Checkbox
                                            checked={!!notification.denied_at}
                                            onCheckedChange={(checked) =>
                                              handleStatusUpdate(
                                                notification.id,
                                                'denied_at',
                                                checked as boolean
                                              )
                                            }
                                            className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                          />
                                          <span className="text-xs text-red-600">✗</span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Mark as withdrawn</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={!!notification.reminder_followup_sent_at}
                                    onCheckedChange={(checked) =>
                                      handleStatusUpdate(
                                        notification.id,
                                        'reminder_followup_sent_at',
                                        checked as boolean
                                      )
                                    }
                                    disabled={!!notification.confirmed_at || !!notification.denied_at}
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      let reminderType: 'initial' | 'reminder1' = 'initial'
                                      if (notification.notification_sent_at && !notification.reminder_followup_sent_at) {
                                        reminderType = 'reminder1'
                                      }
                                      sendNotification(notification.id, reminderType)
                                    }}
                                    disabled={
                                      (!!notification.notification_sent_at && !!notification.reminder_followup_sent_at) || 
                                      (notification.send_status === 'failed' && !notification.notification_sent_at)
                                    }
                                  >
                                    <Mail className="w-4 h-4 mr-1" />
                                    {!notification.notification_sent_at
                                      ? "Send"
                                      : !notification.reminder_followup_sent_at
                                      ? "Remind"
                                      : "All Sent"}
                                  </Button>
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
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center">
                              No notifications found for the current filter.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Content Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test Notification Preview</DialogTitle>
            <DialogDescription>
              This is the content that will be sent in the test notification:
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <pre className="whitespace-pre-wrap text-sm p-4 rounded border">
              {previewContent}
            </pre>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSendTestNotification}>Send Test</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Panel Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Panel Notification</DialogTitle>
            <DialogDescription>
              Update the panel notification details
            </DialogDescription>
          </DialogHeader>
          {editingNotification && (
            <form action={handleEditPanel} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-time_day">Day & Time *</Label>
                  <Input
                    id="edit-time_day"
                    name="time_day"
                    defaultValue={editingNotification.time_day}
                    placeholder="Saturday 2:00 PM"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-room">Room *</Label>
                  <Input
                    id="edit-room"
                    name="room"
                    defaultValue={editingNotification.room}
                    placeholder="Room 101"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-title">Panel Title *</Label>
                <Input
                  id="edit-title"
                  name="title"
                  defaultValue={editingNotification.title}
                  placeholder="Communication Workshop"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-topic">Topic</Label>
                <Input
                  id="edit-topic"
                  name="topic"
                  defaultValue={editingNotification.topic || ""}
                  placeholder="Effective Communication in Recovery"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  name="description"
                  defaultValue={editingNotification.description || ""}
                  placeholder="Brief description of the panel"
                />
              </div>
              <div>
                <Label htmlFor="edit-literature_reference">
                  Literature Reference
                </Label>
                <Input
                  id="edit-literature_reference"
                  name="literature_reference"
                  defaultValue={editingNotification.literature_reference || ""}
                  placeholder="Big Book Chapter 5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-panelist_name">
                    Panelist Name *
                  </Label>
                  <Input
                    id="edit-panelist_name"
                    name="panelist_name"
                    defaultValue={editingNotification.panelist_name}
                    placeholder="John D."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-contact_type">Contact Type *</Label>
                  <select
                    id="edit-contact_type"
                    name="contact_type"
                    defaultValue={editingNotification.contact_type}
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select type</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-panelist_contact">
                  Contact Info *
                </Label>
                <Input
                  id="edit-panelist_contact"
                  name="panelist_contact"
                  defaultValue={editingNotification.panelist_contact}
                  placeholder="john@example.com or +1 (555) 123-4567"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingNotification(null)
                  }}
                  disabled={isEditingPanel}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isEditingPanel}>
                  {isEditingPanel ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    "Update Panel"
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
              Are you sure you want to delete this panel notification? This action cannot be undone.
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

      <Toaster />
    </div>
  )
}
