"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
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
import { createClient } from "@/utils/supabase/client"
import {
  formatMeetingForDisplay,
  parseXLSXMeetingData,
  validateMeetingData,
  type ParsedMeeting
} from "@/utils/xlsx-meeting-parser"
import {
  formatMeetingRaidForDisplay,
  parseXLSXMeetingRaidData,
  validateMeetingRaidData,
  type ParsedMeetingRaid
} from "@/utils/xlsx-meeting-raid-parser"
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Edit,
  Phone,
  Plus,
  Repeat,
  Save,
  Search,
  Trash2,
  Upload,
  User,
  Users,
  X
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  bulkUpsertOutreachReminders,
  createOutreachReminder,
  deleteOutreachReminder,
  updateOutreachReminder
} from "../actions"

interface Person {
  name: string
  phone: string
}

interface OutreachReminder {
  id?: number
  name: string
  details: string
  frequency: string
  reminder_buffer: string
  people: Person[]
}

export function MeetingReminders() {
  const [reminders, setReminders] = useState<OutreachReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [uploadBuffers, setUploadBuffers] = useState<string[]>(["1h"])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedMeetings, setParsedMeetings] = useState<ParsedMeeting[]>([])
  const [showParsedData, setShowParsedData] = useState(false)
  const [showUploadSection, setShowUploadSection] = useState(false)
  const [showAddNewSection, setShowAddNewSection] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [newReminder, setNewReminder] = useState<OutreachReminder>({
    name: "",
    details: "",
    frequency: "",
    reminder_buffer: "",
    people: []
  })
  // Meeting raid states
  const [showMeetingRaidSection, setShowMeetingRaidSection] = useState(false)
  const [meetingRaidFile, setMeetingRaidFile] = useState<File | null>(null)
  const [uploadingRaid, setUploadingRaid] = useState(false)
  const [parsedRaidMeetings, setParsedRaidMeetings] = useState<ParsedMeetingRaid[]>([])
  const [showParsedRaidData, setShowParsedRaidData] = useState(false)
  const [raidUploadBuffers, setRaidUploadBuffers] = useState<string[]>(["1h"])

  const supabase = createClient()

  useEffect(() => {
    fetchReminders()
  }, [])

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from("outreach_reminders")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setReminders(data || [])
    } catch (error) {
      console.error("Error fetching reminders:", error)
      toast.error("Failed to fetch reminders")
    } finally {
      setLoading(false)
    }
  }

  const addUploadBuffer = () => {
    setUploadBuffers([...uploadBuffers, ""])
  }

  const removeUploadBuffer = (index: number) => {
    setUploadBuffers(uploadBuffers.filter((_, i) => i !== index))
  }

  const updateUploadBuffer = (index: number, value: string) => {
    const updated = [...uploadBuffers]
    updated[index] = value
    setUploadBuffers(updated)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please upload an Excel file (.xlsx or .xls)")
      return
    }

    setSelectedFile(file)
    setParsedMeetings([])
    setShowParsedData(false)
  }

  // Meeting Raid handlers
  const handleRaidFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setMeetingRaidFile(file)
    setParsedRaidMeetings([])
    setShowParsedRaidData(false)
  }

  const handleRaidFileUpload = async () => {
    if (!meetingRaidFile) {
      toast.error("Please select a file first")
      return
    }

    const validBuffers = raidUploadBuffers.filter((buffer) => buffer.trim() !== "")
    if (validBuffers.length === 0) {
      toast.error("Please add at least one reminder buffer")
      return
    }

    setUploadingRaid(true)
    try {
      const result = await parseXLSXMeetingRaidData(meetingRaidFile)

      if (result.errors.length > 0) {
        toast.error(`Parsed with ${result.errors.length} errors`)
      }

      if (result.meetings.length === 0) {
        toast.error("No valid meetings found in the file")
        return
      }

      setParsedRaidMeetings(result.meetings)
      setShowParsedRaidData(true)

      toast.success(
        `Successfully parsed ${result.successfulRows} meeting raids from ${result.totalRows} rows`
      )
    } catch (error) {
      console.error("Error parsing file:", error)
      toast.error("Failed to parse file. Please check the format.")
    } finally {
      setUploadingRaid(false)
    }
  }

  const handleImportRaidMeetings = async () => {
    if (parsedRaidMeetings.length === 0) {
      toast.error("No meetings to import")
      return
    }

    const validBuffers = raidUploadBuffers.filter((buffer) => buffer.trim() !== "")
    if (validBuffers.length === 0) {
      toast.error("Please add at least one reminder buffer")
      return
    }

    setUploadingRaid(true)
    try {
      const parsedReminders: OutreachReminder[] = []

      for (const meeting of parsedRaidMeetings) {
        // Skip meetings with validation errors
        const validationErrors = validateMeetingRaidData(meeting)
        if (validationErrors.length > 0) {
          console.warn(
            `Skipping meeting ${meeting.meetingName} due to validation errors:`,
            validationErrors
          )
          continue
        }

        // Convert meeting members to people format
        const people: Person[] = meeting.members.map((member) => ({
          name: member.name,
          phone: member.phone
        }))

        // Parse frequency from meeting raid data
        let frequency = ""
        
        // For meeting raids, we have date, day of week, and time
        if (meeting.date && meeting.time) {
          // Format as "MM/DD at HH:MM AM/PM" which the cron can parse
          frequency = `${meeting.date} at ${meeting.time}`
        } else if (meeting.dayOfWeek && meeting.time) {
          // Use day of week for recurring pattern
          frequency = `${meeting.dayOfWeek} ${meeting.time}`
        } else if (meeting.date) {
          // Just date without time
          frequency = meeting.date
        } else {
          // Skip if no temporal information
          console.warn(
            `Skipping meeting ${meeting.meetingName} - no date/time information`
          )
          continue
        }
        
        // Build meeting details with address
        let meetingDetails = meeting.address || ""

        // Create a reminder for each buffer
        for (const buffer of validBuffers) {
          parsedReminders.push({
            name: meeting.meetingName || "Unnamed Meeting",
            details: meetingDetails,
            frequency,
            reminder_buffer: buffer,
            people
          })
        }
      }

      if (parsedReminders.length === 0) {
        toast.error("No valid meetings to import after validation")
        return
      }

      // Save to database using server action
      const result = await bulkUpsertOutreachReminders(parsedReminders)

      if (result.success) {
        const { updated = 0, inserted = 0 } = result.data || {}
        toast.success(
          `Successfully imported: ${updated} updated, ${inserted} new reminders`
        )
        fetchReminders()
        setShowParsedRaidData(false)
        setParsedRaidMeetings([])
        setMeetingRaidFile(null)
        // Reset file input
        const fileInput = document.getElementById(
          "raid-file-upload"
        ) as HTMLInputElement
        if (fileInput) fileInput.value = ""
      } else {
        toast.error(result.error || "Failed to import reminders")
      }
    } catch (error) {
      console.error("Error importing meetings:", error)
      toast.error("Failed to import meetings")
    } finally {
      setUploadingRaid(false)
    }
  }

  const addRaidUploadBuffer = () => {
    setRaidUploadBuffers([...raidUploadBuffers, ""])
  }

  const updateRaidUploadBuffer = (index: number, value: string) => {
    const updated = [...raidUploadBuffers]
    updated[index] = value
    setRaidUploadBuffers(updated)
  }

  const removeRaidUploadBuffer = (index: number) => {
    setRaidUploadBuffers(raidUploadBuffers.filter((_, i) => i !== index))
  }

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first")
      return
    }

    // Validate that all buffers are filled
    const validBuffers = uploadBuffers.filter((buffer) => buffer.trim() !== "")
    if (validBuffers.length === 0) {
      toast.error("Please add at least one reminder buffer")
      return
    }

    setUploading(true)
    try {
      const result = await parseXLSXMeetingData(selectedFile)

      if (result.errors.length > 0) {
        toast.error(`Parsed with ${result.errors.length} errors`)
      }

      if (result.meetings.length === 0) {
        toast.error("No valid meetings found in the file")
        return
      }

      setParsedMeetings(result.meetings)
      setShowParsedData(true)

      toast.success(
        `Successfully parsed ${result.successfulRows} meetings from ${result.totalRows} rows`
      )
    } catch (error) {
      console.error("Error parsing file:", error)
      toast.error("Failed to parse file. Please check the format.")
    } finally {
      setUploading(false)
    }
  }

  const handleImportMeetings = async () => {
    if (parsedMeetings.length === 0) {
      toast.error("No meetings to import")
      return
    }

    const validBuffers = uploadBuffers.filter((buffer) => buffer.trim() !== "")
    if (validBuffers.length === 0) {
      toast.error("Please add at least one reminder buffer")
      return
    }

    setUploading(true)
    try {
      const parsedReminders: OutreachReminder[] = []

      for (const meeting of parsedMeetings) {
        // Skip meetings with validation errors
        const validationErrors = validateMeetingData(meeting)
        if (validationErrors.length > 0) {
          console.warn(
            `Skipping meeting ${meeting.name} due to validation errors:`,
            validationErrors
          )
          continue
        }

        // Convert meeting members to people format
        const people: Person[] = meeting.members.map((member) => ({
          name: member.name,
          phone: member.phone
        }))

        // Parse frequency from meeting data
        let frequency = ""
        
        // Check if we have date information
        if (meeting.date) {
          // If we have a specific date, use that with time
          if (meeting.time) {
            frequency = `${meeting.date} at ${meeting.time}`
          } else {
            frequency = meeting.date
          }
        } else if (meeting.day && meeting.time) {
          // If we have day of week and time, use that for recurring meetings
          frequency = `${meeting.day} ${meeting.time}`
        } else if (meeting.time) {
          // If we only have time, try to parse it as a one-time event
          frequency = meeting.time
        } else {
          // Default to empty which won't trigger reminders
          frequency = ""
        }
        
        // Build meeting details
        let meetingDetails = meeting.location || ""

        // Create a reminder for each buffer
        for (const buffer of validBuffers) {
          parsedReminders.push({
            name: meeting.name || "Unnamed Meeting",
            details: meetingDetails,
            frequency,
            reminder_buffer: buffer,
            people
          })
        }
      }

      if (parsedReminders.length === 0) {
        toast.error("No valid meetings to import after validation")
        return
      }

      // Save to database using server action
      const result = await bulkUpsertOutreachReminders(parsedReminders)

      if (result.success) {
        const { updated = 0, inserted = 0 } = result.data || {}
        toast.success(
          `Successfully imported: ${updated} updated, ${inserted} new reminders`
        )
        fetchReminders()
        setShowParsedData(false)
        setParsedMeetings([])
        setSelectedFile(null)
        // Reset file input
        const fileInput = document.getElementById(
          "file-upload"
        ) as HTMLInputElement
        if (fileInput) fileInput.value = ""
      } else {
        toast.error(result.error || "Failed to import reminders")
      }
    } catch (error) {
      console.error("Error importing meetings:", error)
      toast.error("Failed to import meetings")
    } finally {
      setUploading(false)
    }
  }

  const handleSaveReminder = async (reminder: OutreachReminder) => {
    if (!reminder.name || !reminder.frequency || !reminder.reminder_buffer) {
      toast.error("Please fill in all required fields")
      return
    }

    try {
      let result
      if (reminder.id) {
        result = await updateOutreachReminder(reminder)
      } else {
        result = await createOutreachReminder(reminder)
      }

      if (result.success) {
        toast.success("Reminder saved successfully")
        setEditingId(null)
        setNewReminder({
          name: "",
          details: "",
          frequency: "",
          reminder_buffer: "",
          people: []
        })
        fetchReminders()
      } else {
        toast.error(result.error || "Failed to save reminder")
      }
    } catch (error) {
      console.error("Error saving reminder:", error)
      toast.error("Failed to save reminder")
    }
  }

  const handleDeleteReminder = async (id: number) => {
    try {
      const result = await deleteOutreachReminder(id)

      if (result.success) {
        toast.success("Reminder deleted successfully")
        fetchReminders()
      } else {
        toast.error(result.error || "Failed to delete reminder")
      }
    } catch (error) {
      console.error("Error deleting reminder:", error)
      toast.error("Failed to delete reminder")
    }
  }

  const addPersonToReminder = (reminder: OutreachReminder) => {
    const updated = {
      ...reminder,
      people: [...reminder.people, { name: "", phone: "" }]
    }
    if (reminder.id) {
      setReminders(reminders.map((r) => (r.id === reminder.id ? updated : r)))
    } else {
      setNewReminder(updated)
    }
  }

  const removePersonFromReminder = (
    reminder: OutreachReminder,
    index: number
  ) => {
    const updated = {
      ...reminder,
      people: reminder.people.filter((_, i) => i !== index)
    }
    if (reminder.id) {
      setReminders(reminders.map((r) => (r.id === reminder.id ? updated : r)))
    } else {
      setNewReminder(updated)
    }
  }

  const updatePersonInReminder = (
    reminder: OutreachReminder,
    index: number,
    field: keyof Person,
    value: string
  ) => {
    const updated = {
      ...reminder,
      people: reminder.people.map((person, i) =>
        i === index ? { ...person, [field]: value } : person
      )
    }
    if (reminder.id) {
      setReminders(reminders.map((r) => (r.id === reminder.id ? updated : r)))
    } else {
      setNewReminder(updated)
    }
  }

  const getMeetingValidationErrors = (meeting: ParsedMeeting): string[] => {
    return validateMeetingData(meeting)
  }

  const hasValidationErrors = (meeting: ParsedMeeting): boolean => {
    return getMeetingValidationErrors(meeting).length > 0
  }

  // Convert reminder buffer to human readable format
  const formatReminderBuffer = (buffer: string): string => {
    const match = buffer.match(/^(\d+)([hdm])$/)
    if (!match) return buffer

    const [, amount, unit] = match
    const num = parseInt(amount)

    switch (unit) {
      case "h":
        return `${num} Hour${num !== 1 ? "s" : ""} Before`
      case "d":
        return `${num} Day${num !== 1 ? "s" : ""} Before`
      case "m":
        return `${num} Minute${num !== 1 ? "s" : ""} Before`
      default:
        return buffer
    }
  }

  // Group reminders by name
  const groupedReminders = reminders.reduce(
    (acc, reminder) => {
      const key = reminder.name
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(reminder)
      return acc
    },
    {} as Record<string, OutreachReminder[]>
  )

  // Filter reminders based on search query
  const filteredGroupedReminders = Object.entries(groupedReminders).filter(
    ([meetingName, meetingReminders]) =>
      meetingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meetingReminders[0].frequency
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      meetingReminders[0].details
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      meetingReminders.some(
        (r) =>
          r.reminder_buffer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          formatReminderBuffer(r.reminder_buffer)
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
  )

  // Pagination calculations
  const totalItems = filteredGroupedReminders.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedReminders = filteredGroupedReminders.slice(
    startIndex,
    endIndex
  )

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 7

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Smart pagination with ellipsis
      if (currentPage <= 4) {
        // Show first 5 pages + ellipsis + last page
        for (let i = 1; i <= 5; i++) pages.push(i)
        if (totalPages > 6) pages.push("...")
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        // Show first page + ellipsis + last 5 pages
        pages.push(1)
        if (totalPages > 6) pages.push("...")
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
      } else {
        // Show first + ellipsis + current-1, current, current+1 + ellipsis + last
        pages.push(1)
        pages.push("...")
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push("...")
        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Meeting Spreadsheet
              </CardTitle>
              <CardDescription>
                Upload an Excel file (.xlsx) with meeting data
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowUploadSection(!showUploadSection)}
            >
              {showUploadSection ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {showUploadSection && (
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Choose Excel file</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="mt-1"
                />
              </div>

              {/* Reminder Buffers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Reminder Times</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addUploadBuffer}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Reminder
                  </Button>
                </div>
                <div className="space-y-2">
                  {uploadBuffers.map((buffer, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder="e.g., '1h', '1d', '30m'"
                        value={buffer}
                        onChange={(e) =>
                          updateUploadBuffer(index, e.target.value)
                        }
                      />
                      {uploadBuffers.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeUploadBuffer(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Each reminder time will create a separate reminder for each
                  meeting in your file. Use formats like '1h' (1 hour), '1d' (1
                  day), '30m' (30 minutes).
                </p>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    onClick={handleFileUpload}
                    disabled={uploading}
                    size="sm"
                  >
                    {uploading ? "Processing..." : "Parse File"}
                  </Button>
                </div>
              )}

              {uploading && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Processing file and parsing meeting data...
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Parsed Data Preview */}
      {showParsedData && parsedMeetings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Parsed Meeting Data
            </CardTitle>
            <CardDescription>
              {parsedMeetings.filter((m) => !hasValidationErrors(m)).length}{" "}
              valid meetings found. Existing reminders with the same meeting
              name and buffer time will be updated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-900">
                      {
                        parsedMeetings.filter((m) => !hasValidationErrors(m))
                          .length
                      }
                    </div>
                    <div className="text-sm text-green-700">Valid Meetings</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Repeat className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-blue-900">
                      {parsedMeetings.filter((m) => m.isRecurring).length}
                    </div>
                    <div className="text-sm text-blue-700">Recurring</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="font-medium text-purple-900">
                      {
                        parsedMeetings.filter((m) => m.isMultipleDaysPerWeek)
                          .length
                      }
                    </div>
                    <div className="text-sm text-purple-700">Multi-Day</div>
                  </div>
                </div>
              </div>

              {/* Meeting Preview */}
              <div className="space-y-3">
                <h4 className="font-medium">Meeting Preview:</h4>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {parsedMeetings.map((meeting, index) => (
                    <MeetingPreviewCard
                      key={meeting.id}
                      meeting={meeting}
                      index={index}
                      validationErrors={getMeetingValidationErrors(meeting)}
                    />
                  ))}
                </div>
              </div>

              {/* Import Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleImportMeetings}
                  disabled={
                    uploading ||
                    parsedMeetings.filter((m) => !hasValidationErrors(m))
                      .length === 0
                  }
                  className="flex-1"
                >
                  {uploading
                    ? "Importing..."
                    : `Import/Update ${parsedMeetings.filter((m) => !hasValidationErrors(m)).length} Valid Meetings`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowParsedData(false)
                    setParsedMeetings([])
                    setSelectedFile(null)
                    const fileInput = document.getElementById(
                      "file-upload"
                    ) as HTMLInputElement
                    if (fileInput) fileInput.value = ""
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meeting Raid Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upload Meeting Raid Spreadsheet
              </CardTitle>
              <CardDescription>
                Upload meeting raid data with columns: A=Date, B=Day, C=Time, D=Meeting Name, E=Address, H-K=Volunteers
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowMeetingRaidSection(!showMeetingRaidSection)}
            >
              {showMeetingRaidSection ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {showMeetingRaidSection && (
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="raid-file-upload">Choose Excel file</Label>
                <Input
                  id="raid-file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleRaidFileSelect}
                  disabled={uploadingRaid}
                  className="mt-1"
                />
              </div>

              {/* Reminder Buffers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Reminder Times</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRaidUploadBuffer}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Reminder
                  </Button>
                </div>
                <div className="space-y-2">
                  {raidUploadBuffers.map((buffer, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        placeholder="e.g., '1h', '1d', '30m'"
                        value={buffer}
                        onChange={(e) =>
                          updateRaidUploadBuffer(index, e.target.value)
                        }
                      />
                      {raidUploadBuffers.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeRaidUploadBuffer(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Each reminder time will create a separate reminder for each
                  meeting raid in your file. Volunteers will be parsed from columns H-K.
                </p>
              </div>

              {meetingRaidFile && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">
                      {meetingRaidFile.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({(meetingRaidFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    onClick={handleRaidFileUpload}
                    disabled={uploadingRaid}
                    size="sm"
                  >
                    {uploadingRaid ? "Processing..." : "Parse File"}
                  </Button>
                </div>
              )}

              {uploadingRaid && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Processing file and parsing meeting raid data...
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Parsed Meeting Raid Data Preview */}
      {showParsedRaidData && parsedRaidMeetings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Parsed Meeting Raid Data
            </CardTitle>
            <CardDescription>
              Review the parsed data before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meeting Name</TableHead>
                    <TableHead>Date/Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Volunteers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRaidMeetings.map((meeting) => (
                    <TableRow key={meeting.id}>
                      <TableCell className="font-medium">
                        {meeting.meetingName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {meeting.date && (
                          <div>{meeting.date}</div>
                        )}
                        {meeting.dayOfWeek && (
                          <div className="text-muted-foreground">{meeting.dayOfWeek}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {meeting.time || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {meeting.address || "-"}
                      </TableCell>
                      <TableCell>
                        {meeting.members.length > 0 ? (
                          <div className="space-y-1">
                            {meeting.members.map((member, idx) => (
                              <div
                                key={idx}
                                className="text-xs flex items-center gap-1"
                              >
                                <User className="h-3 w-3" />
                                <span>{member.name}</span>
                                {member.phone && (
                                  <>
                                    <Phone className="h-3 w-3 ml-1" />
                                    <span className="text-muted-foreground">
                                      {member.phone}
                                    </span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            No volunteers
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                {parsedRaidMeetings.length} meetings will be imported with{" "}
                {raidUploadBuffers.filter((b) => b).length} reminder time(s) each
                = {parsedRaidMeetings.length * raidUploadBuffers.filter((b) => b).length}{" "}
                total reminders
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImportRaidMeetings} disabled={uploadingRaid}>
                  Import All
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowParsedRaidData(false)
                    setParsedRaidMeetings([])
                    setMeetingRaidFile(null)
                    const fileInput = document.getElementById(
                      "raid-file-upload"
                    ) as HTMLInputElement
                    if (fileInput) fileInput.value = ""
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add New Reminder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Reminder
              </CardTitle>
              <CardDescription>
                Create a new outreach reminder manually
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowAddNewSection(!showAddNewSection)}
            >
              {showAddNewSection ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {showAddNewSection && (
          <CardContent>
            <ReminderForm
              reminder={newReminder}
              onUpdate={setNewReminder}
              onSave={() => handleSaveReminder(newReminder)}
              onCancel={() =>
                setNewReminder({
                  name: "",
                  details: "",
                  frequency: "",
                  reminder_buffer: "",
                  people: []
                })
              }
              addPerson={() => addPersonToReminder(newReminder)}
              removePerson={(index) =>
                removePersonFromReminder(newReminder, index)
              }
              updatePerson={(index, field, value) =>
                updatePersonInReminder(newReminder, index, field, value)
              }
            />
          </CardContent>
        )}
      </Card>

      {/* Existing Reminders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Existing Reminders
              </CardTitle>
              <CardDescription>Manage your outreach reminders</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reminders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading reminders...</div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reminders found. Upload a file or create one manually.
            </div>
          ) : filteredGroupedReminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reminders match your search.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meeting Name</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Reminder Times</TableHead>
                    <TableHead>People</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedReminders.map(([meetingName, meetingReminders]) => (
                    <TableRow key={meetingName}>
                      {editingId === meetingReminders[0].id ? (
                        // Edit mode - show editable fields
                        <>
                          <TableCell>
                            <Input
                              value={meetingReminders[0].name}
                              onChange={(e) => {
                                const updated = {
                                  ...meetingReminders[0],
                                  name: e.target.value
                                }
                                setReminders(
                                  reminders.map((r) =>
                                    r.id === meetingReminders[0].id
                                      ? updated
                                      : r
                                  )
                                )
                              }}
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={meetingReminders[0].frequency}
                              onChange={(e) => {
                                const updated = {
                                  ...meetingReminders[0],
                                  frequency: e.target.value
                                }
                                setReminders(
                                  reminders.map((r) =>
                                    r.id === meetingReminders[0].id
                                      ? updated
                                      : r
                                  )
                                )
                              }}
                              className="text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={meetingReminders[0].details}
                              onChange={(e) => {
                                const updated = {
                                  ...meetingReminders[0],
                                  details: e.target.value
                                }
                                setReminders(
                                  reminders.map((r) =>
                                    r.id === meetingReminders[0].id
                                      ? updated
                                      : r
                                  )
                                )
                              }}
                              className="text-sm"
                              placeholder="Details"
                            />
                          </TableCell>
                          <TableCell colSpan={2}>
                            <div className="text-sm text-muted-foreground">
                              Edit people and reminder times in the form below
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleSaveReminder(meetingReminders[0])
                                }
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        // View mode - show data
                        <>
                          <TableCell className="font-medium">
                            {meetingName}
                          </TableCell>
                          <TableCell className="text-sm">
                            {meetingReminders[0].frequency}
                          </TableCell>
                          <TableCell className="text-sm">
                            {meetingReminders[0].details || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {meetingReminders.map((reminder) => (
                                <div
                                  key={reminder.id}
                                  className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs"
                                >
                                  <span>
                                    {formatReminderBuffer(
                                      reminder.reminder_buffer
                                    )}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      reminder.id &&
                                      handleDeleteReminder(reminder.id)
                                    }
                                    className="h-6 w-6 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {meetingReminders[0].people.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {meetingReminders[0].people.map(
                                    (person, index) => (
                                      <div
                                        key={index}
                                        className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs"
                                      >
                                        <div className="flex items-center gap-1">
                                          <User className="h-3 w-3 text-muted-foreground" />
                                          <span className="font-medium text-muted-foreground">
                                            {person.name || "—"}
                                          </span>
                                        </div>
                                        {person.phone && (
                                          <div className="flex items-center gap-1 border-l border-muted-foreground pl-1 ml-1">
                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-muted-foreground">
                                              {person.phone}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const firstReminder = meetingReminders[0]
                                  if (firstReminder.id) {
                                    setEditingId(firstReminder.id)
                                  }
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  // Delete all reminders for this meeting
                                  for (const reminder of meetingReminders) {
                                    if (reminder.id) {
                                      await handleDeleteReminder(reminder.id)
                                    }
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {filteredGroupedReminders.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of{" "}
                {totalItems} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {getPageNumbers().map((page, index) =>
                    page === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-2 text-muted-foreground"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          typeof page === "number" && setCurrentPage(page)
                        }
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    )
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Form Modal */}
      {editingId && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle>Edit People & Reminder Times</CardTitle>
            <CardDescription>
              Use this form to edit the people and reminder times for the
              selected meeting. Basic details can be edited directly in the
              table above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const reminderToEdit = reminders.find((r) => r.id === editingId)
              if (!reminderToEdit) return null

              return (
                <ReminderForm
                  reminder={reminderToEdit}
                  onUpdate={(updated) =>
                    setReminders(
                      reminders.map((r) => (r.id === editingId ? updated : r))
                    )
                  }
                  onSave={() => handleSaveReminder(reminderToEdit)}
                  onCancel={() => setEditingId(null)}
                  addPerson={() => addPersonToReminder(reminderToEdit)}
                  removePerson={(index) =>
                    removePersonFromReminder(reminderToEdit, index)
                  }
                  updatePerson={(index, field, value) =>
                    updatePersonInReminder(reminderToEdit, index, field, value)
                  }
                />
              )
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface MeetingPreviewCardProps {
  meeting: ParsedMeeting
  index: number
  validationErrors: string[]
}

function MeetingPreviewCard({
  meeting,
  index,
  validationErrors
}: MeetingPreviewCardProps) {
  const hasErrors = validationErrors.length > 0

  return (
    <div
      className={`p-3 border rounded-lg ${hasErrors ? "border-red-200 bg-red-50" : "border-border"}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {meeting.name || `Meeting ${index + 1}`}
            </span>
            {hasErrors && <AlertCircle className="h-3 w-3 text-red-500" />}
            {meeting.isRecurring && (
              <div className="flex items-center gap-1 px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                <Repeat className="h-2 w-2" />
                Recurring
              </div>
            )}
            {meeting.isMultipleDaysPerWeek && (
              <div className="flex items-center gap-1 px-1 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                <Calendar className="h-2 w-2" />
                Multi-Day
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatMeetingForDisplay(meeting)}
          </div>
          {meeting.members.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {meeting.members.length} member(s)
            </div>
          )}
          {hasErrors && (
            <div className="text-xs text-red-600 mt-1">
              {validationErrors.join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface ReminderFormProps {
  reminder: OutreachReminder
  onUpdate: (reminder: OutreachReminder) => void
  onSave: () => void
  onCancel: () => void
  addPerson: () => void
  removePerson: (index: number) => void
  updatePerson: (index: number, field: keyof Person, value: string) => void
}

function ReminderForm({
  reminder,
  onUpdate,
  onSave,
  onCancel,
  addPerson,
  removePerson,
  updatePerson
}: ReminderFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={reminder.name}
            onChange={(e) => onUpdate({ ...reminder, name: e.target.value })}
            placeholder="Reminder name"
          />
        </div>
        <div>
          <Label htmlFor="frequency">Frequency *</Label>
          <Input
            id="frequency"
            value={reminder.frequency}
            onChange={(e) =>
              onUpdate({ ...reminder, frequency: e.target.value })
            }
            placeholder="e.g., 'Monday 7PM', '12/25 at 6:30 PM', 'Saturday-Sunday 9AM'"
          />
          <p className="text-xs text-muted-foreground mt-1">
            For recurring: "Monday 7PM", "Daily 10AM", "Saturday-Sunday 9AM"
            <br />
            For one-time: "12/25 at 6:30 PM", "5/31 at 8:30 PM"
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="details">Details</Label>
          <Input
            id="details"
            value={reminder.details}
            onChange={(e) => onUpdate({ ...reminder, details: e.target.value })}
            placeholder="Additional details"
          />
        </div>
        <div>
          <Label htmlFor="buffer">Reminder Time *</Label>
          <Input
            id="buffer"
            value={reminder.reminder_buffer}
            onChange={(e) =>
              onUpdate({ ...reminder, reminder_buffer: e.target.value })
            }
            placeholder="e.g., '1h' (1 hour before), '1d' (1 day before)"
          />
        </div>
      </div>

      {/* People Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>People to Notify</Label>
          <Button type="button" variant="outline" size="sm" onClick={addPerson}>
            <Plus className="h-4 w-4 mr-1" />
            Add Person
          </Button>
        </div>

        {reminder.people.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No people added yet. Click "Add Person" to add contacts.
          </p>
        ) : (
          <div className="space-y-2">
            {reminder.people.map((person, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Name"
                  value={person.name}
                  onChange={(e) => updatePerson(index, "name", e.target.value)}
                />
                <Input
                  placeholder="Phone"
                  value={person.phone}
                  onChange={(e) => updatePerson(index, "phone", e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removePerson(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={onSave} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          Save Reminder
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>
    </div>
  )
}
