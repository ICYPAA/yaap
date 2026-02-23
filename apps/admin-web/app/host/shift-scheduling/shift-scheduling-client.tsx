"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  Grid3x3,
  Plus,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  UserX
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { addVolunteer, deleteShift, saveShift, fetchVolunteers } from "./actions"
import AssignmentDialog from "./components/assignment-dialog"
import ShiftDialog from "./components/shift-dialog"
import {
  CONFERENCE_DATES,
  JOB_TYPES,
  Shift,
  ShiftAssignment,
  Volunteer
} from "./types"
import {
  exportScheduleWithTables,
  importScheduleFromExcel
} from "./utils/export-import"
import { getCoverageStats } from "./utils/scheduling"
import { formatHour12, formatTime12Hour } from "./utils/time-format"

// Helper to convert various time formats to 12hr display
const convertTo12Hour = (timeStr: string): string => {
  if (!timeStr) return timeStr

  // Already in 12hr format (contains am/pm)
  if (/am|pm/i.test(timeStr)) return timeStr

  // Handle 24hr format like "14:00" or "14:00:00"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/)
  if (match) {
    const hour = parseInt(match[1])
    const min = match[2]
    if (hour === 0) return `12:${min} AM`
    if (hour < 12) return `${hour}:${min} AM`
    if (hour === 12) return `12:${min} PM`
    return `${hour - 12}:${min} PM`
  }

  return timeStr
}

interface Props {
  initialShifts: Shift[]
  allVolunteers: Volunteer[]
  currentUserId: string
  venueRooms: string[]
}

export default function ShiftSchedulingClient({
  initialShifts,
  allVolunteers: initialVolunteers,
  currentUserId,
  venueRooms
}: Props) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [allVolunteers, setAllVolunteers] = useState<Volunteer[]>(initialVolunteers)
  const [viewMode, setViewMode] = useState<"day" | "job" | "person">("day")
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(
    JOB_TYPES.map((j) => j.name)
  )
  const [statusFilter, setStatusFilter] = useState<
    "all" | "unassigned" | "confirmed"
  >("all")
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [selectedPersonName, setSelectedPersonName] = useState<string>("")
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(
    null
  )
  const [volunteerInfoDialogOpen, setVolunteerInfoDialogOpen] = useState(false)
  const [newVolunteerData, setNewVolunteerData] = useState({
    firstName: "",
    lastInitial: "",
    email: "",
    phone: ""
  })
  const [unassignedSearchQuery, setUnassignedSearchQuery] = useState("")

  // Get unassigned volunteers (all types except host committee)
  const unassignedVolunteers = useMemo(() => {
    const assignedIds = new Set(
      shifts.flatMap((s) => s.assignments.map((a) => a.id))
    )

    let filtered = allVolunteers.filter(
      (v) =>
        !assignedIds.has(v.id) &&
        v.type !== "host" // Include all volunteer types except host committee members
    )
    
    // Apply search filter
    if (unassignedSearchQuery) {
      filtered = filtered.filter(
        (v) =>
          v.name.toLowerCase().includes(unassignedSearchQuery.toLowerCase()) ||
          v.contact_info?.toLowerCase().includes(unassignedSearchQuery.toLowerCase()) ||
          v.volunteer_type?.toLowerCase().includes(unassignedSearchQuery.toLowerCase())
      )
    }
    
    return filtered
  }, [shifts, allVolunteers, unassignedSearchQuery])

  // Get coverage statistics
  const coverageStats = useMemo(() => getCoverageStats(shifts), [shifts])

  const filteredShifts = useMemo(() => {
    let filtered = shifts

    if (selectedJobTypes.length > 0) {
      filtered = filtered.filter((shift) =>
        selectedJobTypes.includes(shift.job_type)
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((shift) => {
        const hasAssignments = shift.assignments.length > 0
        if (statusFilter === "unassigned") {
          return (
            !hasAssignments || shift.assignments.length < shift.min_volunteers
          )
        } else if (statusFilter === "confirmed") {
          return hasAssignments
        }
        return true
      })
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (shift) =>
          shift.job_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (Array.isArray(shift.location)
            ? shift.location.some((loc) =>
                loc.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : false) ||
          shift.assignments.some((a) =>
            a.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    }

    return filtered
  }, [shifts, selectedJobTypes, statusFilter, searchQuery])

  const getShiftsForDay = (date: string, jobType?: string) => {
    return filteredShifts
      .filter((shift) => {
        const sameDay = shift.date === date
        if (jobType) {
          return sameDay && shift.job_type === jobType
        }
        return sameDay
      })
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  // Group overlapping shifts into columns to prevent visual overlap
  const groupOverlappingShifts = (shifts: Shift[]): Shift[][] => {
    if (shifts.length === 0) return []

    const columns: Shift[][] = []

    shifts.forEach((shift) => {
      const shiftStart = shift.start_time
      const shiftEnd = shift.end_time

      // Find a column where this shift doesn't overlap
      let placed = false
      for (let col of columns) {
        const hasOverlap = col.some((s) => {
          // Check if times overlap
          return shiftStart < s.end_time && shiftEnd > s.start_time
        })

        if (!hasOverlap) {
          col.push(shift)
          placed = true
          break
        }
      }

      // If no column found without overlap, create a new column
      if (!placed) {
        columns.push([shift])
      }
    })

    return columns
  }

  const handleSaveShift = async (shiftData: Partial<Shift>) => {
    try {
      const savedShift = await saveShift(shiftData as Shift)
      if (selectedShift) {
        setShifts(
          shifts.map((s) => (s.id === selectedShift.id ? savedShift : s))
        )
        toast.success("Shift updated")
      } else {
        setShifts([...shifts, savedShift])
        toast.success("Shift created")
      }
      setShiftDialogOpen(false)
      setSelectedShift(null)
    } catch (error) {
      toast.error("Failed to save shift")
    }
  }

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null)

  const handleDeleteShiftClick = async (shift: Shift, e: React.MouseEvent) => {
    e.stopPropagation()
    setShiftToDelete(shift)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteShift = async (shiftId: string) => {
    const shift = shifts.find(s => s.id === shiftId)
    if (shift) {
      setShiftToDelete(shift)
      setDeleteConfirmOpen(true)
    }
  }

  const confirmDelete = async () => {
    if (!shiftToDelete) return
    try {
      await deleteShift(shiftToDelete.id)
      setShifts(shifts.filter((s) => s.id !== shiftToDelete.id))
      toast.success("Shift deleted")
      setDeleteConfirmOpen(false)
      setShiftToDelete(null)
      // If we're deleting the selected shift, clear it
      if (selectedShift?.id === shiftToDelete.id) {
        setSelectedShift(null)
        setShiftDialogOpen(false)
      }
    } catch (error) {
      toast.error("Failed to delete shift")
    }
  }

  const handleAssignVolunteer = async (shift: Shift, volunteer: Volunteer) => {
    const assignment: ShiftAssignment = {
      id: volunteer.id,
      name: volunteer.name,
      type: volunteer.volunteer_type || volunteer.type || 'volunteer',
      contact: volunteer.contact_info,
      sourceTable: volunteer.source_table,
      volunteering_interest_id: volunteer.volunteering_interest_id
    }

    const updatedAssignments = [...shift.assignments, assignment]
    const updatedShift = { ...shift, assignments: updatedAssignments }

    try {
      const savedShift = await saveShift(updatedShift)
      setShifts(shifts.map((s) => (s.id === shift.id ? savedShift : s)))
      // Update selectedShift if it's the one being modified
      if (selectedShift?.id === shift.id) {
        setSelectedShift(savedShift)
      }
      toast.success(`Assigned ${volunteer.name} to ${shift.job_type}`)
    } catch (error) {
      toast.error("Failed to assign volunteer")
    }
  }

  const handleRemoveAssignment = async (shift: Shift, volunteerId: string) => {
    const updatedAssignments = shift.assignments.filter(
      (a) => a.id !== volunteerId
    )
    const updatedShift = { ...shift, assignments: updatedAssignments }

    try {
      const savedShift = await saveShift(updatedShift)
      setShifts(shifts.map((s) => (s.id === shift.id ? savedShift : s)))
      // Update selectedShift if it's the one being modified
      if (selectedShift?.id === shift.id) {
        setSelectedShift(savedShift)
      }
      toast.success("Assignment removed")
    } catch (error) {
      toast.error("Failed to remove assignment")
    }
  }

  const handleEditShift = (shift: Shift, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedShift(shift)
    setShiftDialogOpen(true)
  }

  const renderShiftCard = (shift: Shift, compact = false) => {
    const isUnderStaffed = shift.assignments.length < shift.min_volunteers
    const isFullyStaffed = shift.assignments.length >= shift.max_volunteers
    const jobType = JOB_TYPES.find((jt) => jt.name === shift.job_type)

    // Calculate duration in minutes
    const startHour = parseInt(shift.start_time.slice(0, 2))
    const startMin = parseInt(shift.start_time.slice(3, 5))
    const endHour = parseInt(shift.end_time.slice(0, 2))
    const endMin = parseInt(shift.end_time.slice(3, 5))
    const duration = endHour * 60 + endMin - (startHour * 60 + startMin)
    const isOneHour = duration <= 60 && compact

    return (
      <Card
        key={shift.id}
        className={`p-2 cursor-pointer hover:shadow-md transition-shadow h-full flex flex-col min-w-[200px] ${
          isUnderStaffed ? "border-orange-500" : ""
        }`}
        style={{
          backgroundColor: jobType ? `${jobType.color}20` : undefined
        }}
        onClick={() => {
          setSelectedShift(shift)
          setAssignmentDialogOpen(true)
        }}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex-1">
            <p className="font-medium text-xs">{shift.job_type}</p>
            {/* Skip location for 1-hour shifts */}
            {!isOneHour && shift.location && shift.location.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {shift.location.join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Skip volunteer count badge for 1-hour shifts if max is 1 */}
            {(!isOneHour || shift.max_volunteers > 1) && (
              <Badge
                variant={
                  isUnderStaffed
                    ? "destructive"
                    : isFullyStaffed
                      ? "default"
                      : "secondary"
                }
                className="text-xs h-5"
              >
                {shift.assignments.length}/{shift.max_volunteers}
              </Badge>
            )}
            {!compact && (
              <Badge
                variant={
                  isUnderStaffed
                    ? "destructive"
                    : isFullyStaffed
                      ? "default"
                      : "secondary"
                }
                className="text-xs h-5"
              >
                {shift.assignments.length}/{shift.max_volunteers}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
          <Clock className="h-3 w-3" />
          <span>
            {formatTime12Hour(shift.start_time)}
            {!isOneHour && ` - ${formatTime12Hour(shift.end_time)}`}
          </span>
        </div>

        {/* Display notes if present */}
        {shift.notes && (
          <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
            {shift.notes}
          </p>
        )}

        {shift.assignments.length > 0 && (
          <div className="space-y-1 flex-1 overflow-hidden">
            {shift.assignments.slice(0, isOneHour ? 1 : 2).map((assignment) => (
              <Badge
                key={assignment.id}
                variant={assignment.type === "host" ? "default" : "outline"}
                className="text-xs mr-1 truncate"
              >
                {assignment.type === "host" && (
                  <User className="h-3 w-3 mr-1" />
                )}
                {assignment.name}
              </Badge>
            ))}
            {shift.assignments.length > (isOneHour ? 1 : 2) && (
              <Badge variant="secondary" className="text-xs">
                +{shift.assignments.length - (isOneHour ? 1 : 2)} more
              </Badge>
            )}
          </div>
        )}

        {/* Skip "Need X more" for 1-hour shifts */}
        {!isOneHour && isUnderStaffed && (
          <div className="flex items-center gap-1 mt-1">
            <AlertTriangle className="h-3 w-3 text-orange-500" />
            <span className="text-xs text-orange-500">
              Need {shift.min_volunteers - shift.assignments.length} more
            </span>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="px-6 py-6 w-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Shift Scheduling</h1>
          <p className="text-muted-foreground">August 28-31, 2025 (CST)</p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) {
                try {
                  const importedShifts = await importScheduleFromExcel(file)

                  // Merge imported shifts with existing ones
                  const shiftMap = new Map(shifts.map((s) => [s.id, s]))
                  importedShifts.forEach((importedShift) => {
                    shiftMap.set(importedShift.id, importedShift)
                  })

                  const updatedShifts = Array.from(shiftMap.values())
                  setShifts(updatedShifts)

                  // Save all updated shifts
                  await Promise.all(
                    updatedShifts.map((shift) => saveShift(shift))
                  )

                  toast.success(
                    `Imported ${importedShifts.length} shifts successfully`
                  )
                } catch (error) {
                  console.error("Import error:", error)
                  toast.error(
                    "Failed to import schedule. Please check the file format."
                  )
                }
                e.target.value = "" // Reset file input
              }
            }}
            className="hidden"
            id="import-schedule"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("import-schedule")?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportScheduleWithTables(shifts)}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedVolunteer(null)
              setVolunteerInfoDialogOpen(true)
            }}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Add Volunteer
          </Button>
          <Button
            onClick={() => {
              setSelectedShift(null) // Clear selected shift for empty modal
              setShiftDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Shift
          </Button>
        </div>
      </div>

      {/* Coverage Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{coverageStats.totalShifts}</div>
          <div className="text-sm text-muted-foreground">Total Shifts</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">
            {coverageStats.filledSlots}/{coverageStats.totalSlots}
          </div>
          <div className="text-sm text-muted-foreground">Slots Filled</div>
        </Card>
        <Card className="p-4 border-orange-200">
          <div className="text-2xl font-bold text-orange-600">
            {coverageStats.shiftsNeedingCoverage}
          </div>
          <div className="text-sm text-muted-foreground">Need Coverage</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {unassignedVolunteers.length}
          </div>
          <div className="text-sm text-muted-foreground">
            Unassigned Volunteers
          </div>
        </Card>
      </div>

      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule View</TabsTrigger>
          <TabsTrigger value="unassigned" className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Unassigned ({unassignedVolunteers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-4">
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label>Search</Label>
                  <Input
                    placeholder="Search shifts, volunteers, locations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="min-w-[150px]">
                  <Label>View Mode</Label>
                  <Select
                    value={viewMode}
                    onValueChange={(v) =>
                      setViewMode(v as "job" | "day" | "person")
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          By Day
                        </div>
                      </SelectItem>
                      <SelectItem value="job">
                        <div className="flex items-center gap-2">
                          <Grid3x3 className="h-4 w-4" />
                          By Job Type
                        </div>
                      </SelectItem>
                      <SelectItem value="person">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Person Schedule
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[150px]">
                  <Label>Status Filter</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as any)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Shifts</SelectItem>
                      <SelectItem value="unassigned">Needs Coverage</SelectItem>
                      <SelectItem value="confirmed">Has Volunteers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4 w-full h-[calc(100vh-500px)] min-h-[500px] overflow-hidden">
            <div className="h-full w-full overflow-auto">
              {viewMode === "day" ? (
                <div className="w-full">
                  {/* Day navigation - fixed width centered */}
                  <div className="flex items-center justify-center gap-4 mb-16">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedDayIndex(Math.max(0, selectedDayIndex - 1))
                      }
                      disabled={selectedDayIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <h3 className="text-lg font-semibold min-w-[200px] text-center">
                      {CONFERENCE_DATES.days[selectedDayIndex].label}
                    </h3>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedDayIndex(
                          Math.min(
                            CONFERENCE_DATES.days.length - 1,
                            selectedDayIndex + 1
                          )
                        )
                      }
                      disabled={
                        selectedDayIndex === CONFERENCE_DATES.days.length - 1
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Time grid for selected day - full width */}
                  <div className="relative mt-20 w-full">
                    <div className="flex w-full" style={{ minWidth: 'max-content' }}>
                      {/* Y-axis with 12-hour time labels - includes 12am at bottom */}
                      <div
                        className="w-20 flex-shrink-0 pr-2"
                        style={{ paddingTop: "40px" }}
                      >
                        {Array.from({ length: 25 }, (_, hour) => (
                          <div
                            key={hour}
                            className="h-20 flex items-start border-t border-muted-foreground/10"
                          >
                            <span className="text-xs text-muted-foreground mt-1">
                              {hour === 24 ? "12 AM" : formatHour12(hour % 24)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Shifts for selected day with proper positioning */}
                      <div className="flex-1 relative">
                        {(() => {
                          const dayShifts = getShiftsForDay(
                            CONFERENCE_DATES.days[selectedDayIndex].date
                          )

                          // Group shifts by job type for consistent column placement
                          const jobTypeColumns: Record<string, Shift[]> = {}
                          const jobTypeOrder = [
                            "Registration",
                            "Security",
                            "Marathon Meetings",
                            "Merch",
                            "Greeting",
                            "Clean up",
                            "Hospitality"
                          ]

                          // Initialize columns for each job type
                          jobTypeOrder.forEach((jobType) => {
                            jobTypeColumns[jobType] = []
                          })

                          // Assign shifts to their job type column
                          dayShifts.forEach((shift) => {
                            if (jobTypeColumns[shift.job_type]) {
                              jobTypeColumns[shift.job_type].push(shift)
                            } else {
                              // For any job types not in our order, add them
                              jobTypeColumns[shift.job_type] = [shift]
                            }
                          })

                          // Filter out empty columns and create final column array
                          const columns = Object.entries(jobTypeColumns)
                            .filter(([_, shifts]) => shifts.length > 0)
                            .map(([jobType, shifts]) => ({ jobType, shifts }))

                          // Use minimum column width of 200px, expand for overlaps
                          const minColumnWidth = 200
                          const baseColumnWidth = minColumnWidth
                          
                          // Calculate total width accounting for overlapping shifts
                          let totalWidth = 0
                          columns.forEach(col => {
                            const overlappingGroups = groupOverlappingShifts(col.shifts)
                            totalWidth += baseColumnWidth * Math.max(1, overlappingGroups.length)
                          })

                          return (
                            <div
                              style={{
                                width: `${totalWidth}px`,
                                position: "relative",
                                minWidth: "100%",
                                paddingTop: "40px"
                              }}
                            >
                              {/* Hour lines - now 25 to include final 12am */}
                              {Array.from({ length: 25 }, (_, hour) => (
                                <div
                                  key={hour}
                                  className="absolute left-0 border-t border-muted-foreground/10"
                                  style={{
                                    top: `${hour * 80 + 40}px`,
                                    width: `${totalWidth}px`
                                  }}
                                />
                              ))}

                              {/* Column headers for job types */}
                              <div
                                className="absolute top-0 left-0 flex"
                                style={{
                                  width: `${totalWidth}px`,
                                  height: "40px"
                                }}
                              >
                                {columns.map((col, idx) => {
                                  const baseColumnWidth = Math.max(200, minColumnWidth)
                                  const overlappingGroups = groupOverlappingShifts(col.shifts)
                                  const expandedWidth = baseColumnWidth * Math.max(1, overlappingGroups.length)
                                  
                                  // Calculate actual left position accounting for previous expanded columns
                                  let leftPosition = 0
                                  for (let i = 0; i < idx; i++) {
                                    const prevGroups = groupOverlappingShifts(columns[i].shifts)
                                    leftPosition += baseColumnWidth * Math.max(1, prevGroups.length)
                                  }
                                  
                                  return (
                                    <div
                                      key={col.jobType}
                                      className="text-xs font-medium truncate px-1 flex items-center justify-center bg-muted/50 border-b"
                                      style={{
                                        position: "absolute",
                                        left: `${leftPosition}px`,
                                        width: `${expandedWidth}px`,
                                        height: "40px"
                                      }}
                                    >
                                      {col.jobType}
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Shift columns by job type */}
                              {columns.map((col, colIndex) => {
                                // Group overlapping shifts within this job type column
                                const overlappingGroups = groupOverlappingShifts(col.shifts)
                                const baseColumnWidth = Math.max(200, minColumnWidth)
                                const expandedWidth = baseColumnWidth * Math.max(1, overlappingGroups.length)
                                
                                // Calculate actual left position accounting for previous expanded columns
                                let leftPosition = 0
                                for (let i = 0; i < colIndex; i++) {
                                  const prevGroups = groupOverlappingShifts(columns[i].shifts)
                                  leftPosition += baseColumnWidth * Math.max(1, prevGroups.length)
                                }
                                
                                return (
                                  <div
                                    key={col.jobType}
                                    className="absolute"
                                    style={{
                                      top: "40px",
                                      left: `${leftPosition}px`,
                                      width: `${expandedWidth}px`,
                                      height: `${25 * 80}px`
                                    }}
                                  >
                                    {overlappingGroups.map((group, groupIdx) => (
                                      <div key={groupIdx}>
                                        {group.map((shift) => {
                                    const startHour = parseInt(
                                      shift.start_time.slice(0, 2)
                                    )
                                    const startMin = parseInt(
                                      shift.start_time.slice(3, 5)
                                    )
                                    const endHour = parseInt(
                                      shift.end_time.slice(0, 2)
                                    )
                                    const endMin = parseInt(
                                      shift.end_time.slice(3, 5)
                                    )

                                    // Handle times that go past midnight
                                    let endTotalMinutes = endHour * 60 + endMin
                                    if (endHour === 23 && endMin === 59) {
                                      endTotalMinutes = 24 * 60 // Midnight
                                    }
                                    const startTotalMinutes =
                                      startHour * 60 + startMin

                                    const duration =
                                      endTotalMinutes - startTotalMinutes
                                    const top = (startTotalMinutes / 60) * 80
                                    const height = Math.max(
                                      40,
                                      (duration / 60) * 80
                                    ) // Min height for readability

                                          return (
                                            <div
                                              key={shift.id}
                                              className="absolute px-1"
                                              style={{
                                                top: `${top}px`,
                                                height: `${height}px`,
                                                left: `${groupIdx * baseColumnWidth}px`,
                                                width: `${baseColumnWidth - 4}px`,
                                              }}
                                            >
                                              {renderShiftCard(shift, true)}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : viewMode === "person" ? (
                <div className="space-y-4">
                  {/* Person selector */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter person's name..."
                      value={selectedPersonName}
                      onChange={(e) => setSelectedPersonName(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  {selectedPersonName && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">
                        Schedule for: {selectedPersonName}
                      </h3>

                      {/* Show all days in a grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {CONFERENCE_DATES.days.map((day) => {
                          const personShifts = shifts
                            .filter(
                              (shift) =>
                                shift.date === day.date &&
                                shift.assignments.some((a) =>
                                  a.name
                                    .toLowerCase()
                                    .includes(selectedPersonName.toLowerCase())
                                )
                            )
                            .sort((a, b) =>
                              a.start_time.localeCompare(b.start_time)
                            )

                          return (
                            <Card key={day.date} className="p-4">
                              <h4 className="font-semibold mb-3">
                                {day.label}
                              </h4>
                              {personShifts.length > 0 ? (
                                <div className="space-y-2">
                                  {personShifts.map((shift) => {
                                    // Find the specific assignment for this person
                                    const personAssignment = shift.assignments.find((a) =>
                                      a.name.toLowerCase().includes(selectedPersonName.toLowerCase())
                                    )
                                    
                                    return (
                                      <div
                                        key={shift.id}
                                        className="p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                                        style={{
                                          backgroundColor:
                                            JOB_TYPES.find(
                                              (jt) => jt.name === shift.job_type
                                            )?.color + "20"
                                        }}
                                        onClick={() => {
                                          setSelectedShift(shift)
                                          setAssignmentDialogOpen(true)
                                        }}
                                      >
                                        <p className="font-medium text-sm">
                                          {shift.job_type}
                                        </p>
                                        {personAssignment && (
                                          <p className="text-xs font-medium text-primary mt-1">
                                            As: {personAssignment.name}
                                          </p>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                          {formatTime12Hour(shift.start_time)} -{" "}
                                          {formatTime12Hour(shift.end_time)}
                                        </p>
                                        {shift.location &&
                                          shift.location.length > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                              {shift.location.join(", ")}
                                            </p>
                                          )}
                                        {shift.assignments.length > 1 && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            With {shift.assignments.length - 1} other{shift.assignments.length > 2 ? 's' : ''}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No shifts scheduled
                                </p>
                              )}
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 w-full">
                  {selectedJobTypes.map((jobType) => {
                    const jobTypeConfig = JOB_TYPES.find(
                      (jt) => jt.name === jobType
                    )
                    return (
                      <div key={jobType}>
                        <div
                          className="font-semibold text-lg mb-3 pb-2 border-b flex items-center gap-2"
                          style={{ borderColor: jobTypeConfig?.color }}
                        >
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: jobTypeConfig?.color }}
                          />
                          {jobType}
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {CONFERENCE_DATES.days.map((day) => {
                            const dayShifts = getShiftsForDay(day.date, jobType)
                            return (
                              <div key={day.date}>
                                <div className="text-sm font-medium text-muted-foreground mb-2">
                                  {day.label.split(",")[0]}
                                </div>
                                <div className="space-y-2">
                                  {dayShifts.length > 0 ? (
                                    dayShifts.map((shift) =>
                                      renderShiftCard(shift, true)
                                    )
                                  ) : (
                                    <Card className="p-3 border-dashed">
                                      <p className="text-xs text-muted-foreground text-center">
                                        No shifts
                                      </p>
                                    </Card>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="unassigned">
          <Card className="p-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">
                General Interest Volunteers
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                These volunteers signed up for general interest and haven't been
                assigned to any shifts yet. Click on a volunteer to see
                suggested shifts.
              </p>
              <Input
                placeholder="Search unassigned volunteers..."
                value={unassignedSearchQuery}
                onChange={(e) => setUnassignedSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>

            {unassignedVolunteers.length > 0 ? (
              <ScrollArea className="h-[500px]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unassignedVolunteers.map((volunteer, idx) => (
                    <Card
                      key={`${volunteer.id}-${volunteer.name}-${idx}`}
                      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedVolunteer(volunteer)
                        setVolunteerInfoDialogOpen(true)
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{volunteer.name}</p>
                          {volunteer.contact_info && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {volunteer.contact_info}
                            </p>
                          )}
                          <Badge variant="secondary" className="mt-2">
                            {volunteer.volunteer_type || "general"}
                          </Badge>
                        </div>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <UserX className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>All volunteers have been assigned to shifts!</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <ShiftDialog
        open={shiftDialogOpen}
        onOpenChange={setShiftDialogOpen}
        shift={selectedShift}
        onSave={handleSaveShift}
        onDelete={handleDeleteShift}
        venueRooms={venueRooms}
      />

      <AssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        shift={selectedShift}
        allVolunteers={allVolunteers}
        onAssign={handleAssignVolunteer}
        onRemove={handleRemoveAssignment}
        onEdit={(shift) => {
          setSelectedShift(shift)
          setShiftDialogOpen(true)
        }}
        onDelete={(shift) => {
          setShiftToDelete(shift)
          setDeleteConfirmOpen(true)
        }}
        shifts={shifts}
      />

      {/* Add Volunteer Dialog */}
      <Dialog
        open={volunteerInfoDialogOpen && !selectedVolunteer}
        onOpenChange={(open) => {
          if (!open) {
            setVolunteerInfoDialogOpen(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Volunteer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-volunteer-first-name">First Name *</Label>
                <Input
                  id="new-volunteer-first-name"
                  placeholder="John"
                  value={newVolunteerData.firstName}
                  onChange={(e) => setNewVolunteerData({ ...newVolunteerData, firstName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="new-volunteer-last-initial">Last Initial *</Label>
                <Input
                  id="new-volunteer-last-initial"
                  placeholder="S. or Smi"
                  maxLength={3}
                  value={newVolunteerData.lastInitial}
                  onChange={(e) => setNewVolunteerData({ ...newVolunteerData, lastInitial: e.target.value.slice(0, 3) })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new-volunteer-email">Email {!newVolunteerData.phone && "*"}</Label>
              <Input
                id="new-volunteer-email"
                type="email"
                placeholder="volunteer@example.com"
                value={newVolunteerData.email}
                onChange={(e) => setNewVolunteerData({ ...newVolunteerData, email: e.target.value })}
              />
              {!newVolunteerData.phone && !newVolunteerData.email && (
                <p className="text-xs text-muted-foreground mt-1">Email or phone is required</p>
              )}
            </div>
            <div>
              <Label htmlFor="new-volunteer-phone">Phone {!newVolunteerData.email && "*"}</Label>
              <Input
                id="new-volunteer-phone"
                type="tel"
                placeholder="(123) 456-7890"
                value={newVolunteerData.phone}
                onChange={(e) => setNewVolunteerData({ ...newVolunteerData, phone: e.target.value })}
              />
              {!newVolunteerData.phone && !newVolunteerData.email && (
                <p className="text-xs text-muted-foreground mt-1">Email or phone is required</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setVolunteerInfoDialogOpen(false)
                  setNewVolunteerData({ firstName: "", lastInitial: "", email: "", phone: "" })
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  // Validate form
                  if (!newVolunteerData.firstName.trim()) {
                    toast.error("First name is required")
                    return
                  }
                  if (!newVolunteerData.lastInitial.trim()) {
                    toast.error("Last initial is required")
                    return
                  }
                  if (!newVolunteerData.email.trim() && !newVolunteerData.phone.trim()) {
                    toast.error("Either email or phone is required")
                    return
                  }
                  
                  try {
                    // Add the volunteer to the database
                    await addVolunteer({
                      firstName: newVolunteerData.firstName.trim(),
                      lastInitial: newVolunteerData.lastInitial.trim(),
                      email: newVolunteerData.email.trim(),
                      phone: newVolunteerData.phone.trim()
                    })
                    
                    const fullName = `${newVolunteerData.firstName} ${newVolunteerData.lastInitial}.`
                    toast.success(`Added ${fullName} as a volunteer`)
                    
                    // Reset form and close
                    setNewVolunteerData({ firstName: "", lastInitial: "", email: "", phone: "" })
                    setVolunteerInfoDialogOpen(false)
                    
                    // Refresh the volunteer list
                    const updatedVolunteers = await fetchVolunteers()
                    setAllVolunteers(updatedVolunteers)
                  } catch (error) {
                    toast.error("Failed to add volunteer. Please try again.")
                    console.error("Error adding volunteer:", error)
                  }
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Volunteer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Volunteer Info Dialog */}
      <Dialog
        open={volunteerInfoDialogOpen && !!selectedVolunteer}
        onOpenChange={setVolunteerInfoDialogOpen}
      >
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Volunteer Information</DialogTitle>
          </DialogHeader>
          {selectedVolunteer && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Name</Label>
                <p className="font-medium">{selectedVolunteer.name}</p>
              </div>
              {selectedVolunteer.contact_info && (
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Contact
                  </Label>
                  <p>{selectedVolunteer.contact_info}</p>
                </div>
              )}
              <div>
                <Label className="text-sm text-muted-foreground">Type</Label>
                <Badge variant="secondary">
                  {selectedVolunteer.volunteer_type || "general"}
                </Badge>
              </div>
              {selectedVolunteer.data && (
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Additional Information
                  </Label>
                  <div className="mt-2 p-3 bg-muted rounded-md break-words overflow-wrap-anywhere">
                    {selectedVolunteer.volunteer_type === "greeter" &&
                      selectedVolunteer.data.day && (
                        <p>Day: {selectedVolunteer.data.day}</p>
                      )}
                    {selectedVolunteer.volunteer_type === "greeter" &&
                      (selectedVolunteer.data.time_slot ||
                        selectedVolunteer.data.time) && (
                        <p>
                          Time:{" "}
                          {convertTo12Hour(
                            selectedVolunteer.data.time_slot ||
                              selectedVolunteer.data.time
                          )}
                        </p>
                      )}
                    {selectedVolunteer.volunteer_type === "greeter" &&
                      selectedVolunteer.data.room && (
                        <p>Room: {selectedVolunteer.data.room}</p>
                      )}
                    {selectedVolunteer.volunteer_type === "cleanup" &&
                      selectedVolunteer.data.date && (
                        <p>Date: {selectedVolunteer.data.date}</p>
                      )}
                    {selectedVolunteer.volunteer_type === "cleanup" &&
                      selectedVolunteer.data.time && (
                        <p>
                          Time: {convertTo12Hour(selectedVolunteer.data.time)}
                        </p>
                      )}
                    {selectedVolunteer.volunteer_type === "cleanup" &&
                      selectedVolunteer.data.location && (
                        <p>Location: {selectedVolunteer.data.location}</p>
                      )}
                    {!["greeter", "cleanup"].includes(
                      selectedVolunteer.volunteer_type || ""
                    ) && (
                      <pre className="text-xs">
                        {JSON.stringify(selectedVolunteer.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setVolunteerInfoDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this shift? This action cannot be undone.
              {shiftToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <p className="font-medium">{shiftToDelete.job_type}</p>
                  <p className="text-sm">
                    {formatTime12Hour(shiftToDelete.start_time)} - {formatTime12Hour(shiftToDelete.end_time)}
                  </p>
                  {shiftToDelete.assignments.length > 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      ⚠️ This shift has {shiftToDelete.assignments.length} volunteer(s) assigned
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete Shift
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
