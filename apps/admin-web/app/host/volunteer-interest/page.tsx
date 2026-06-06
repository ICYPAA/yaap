"use client"

import { useToast } from "@/components/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { ArrowDown, ArrowUp, Loader2, MessageSquare, Search, X, Edit, Trash2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { 
  getVolunteerInterest, 
  updateVolunteerStatus, 
  deleteVolunteerInterest, 
  updateVolunteerInterest,
  getSecurityTimeSlotAssignments,
  addSecurityTimeSlotAssignment,
  removeSecurityTimeSlotAssignment,
  getCurrentConferenceDates
} from "./actions"
import {
  getGreeterVolunteers,
  upsertGreeterVolunteers,
  updateGreeterVolunteer,
  deleteGreeterVolunteer
} from "./greeter-actions"
import {
  getCleanupVolunteers,
  upsertCleanupVolunteers,
  updateCleanupVolunteer,
  deleteCleanupVolunteer
} from "./cleanup-actions"
import SecurityTimeSlotManager from "./components/SecurityTimeSlotManager"
import GreeterUpload from "./components/GreeterUpload"
import CleanupUpload from "./components/CleanupUpload"

enum VolunteerInterestTab {
  GENERAL = "general",
  REGISTRATION = "registration",
  SECURITY = "security",
  MARATHON = "marathon",
  HOSPITALITY = "hospitality",
  OUTREACH = "outreach",
  MERCH = "merch",
  GREETER = "greeter",
  CLEANUP = "cleanup",
  ENTERTAINMENT = "entertainment"
}

// Define the structure of a volunteer interest record
interface VolunteerInterest {
  id: string
  name: string
  last_initial: string
  phone: string | null
  email: string | null
  type: "general" | "marathon" | "hospitality" | "outreach" | "merch" | "registration" | "security" | "greeter" | "cleanup" | "entertainment"
  status?: string
  data: {
    interests?: {
      greeter: boolean
      security: boolean
      cleanup: boolean
      setup: boolean
      host_committee: boolean
      wherever_needed: boolean
    }
    time_slots?: {
      thursday_pm: boolean
      friday_am: boolean
      friday_midday: boolean
      friday_pm: boolean
      saturday_am: boolean
      saturday_midday: boolean
      saturday_pm: boolean
      sunday_am: boolean
      sunday_midday: boolean
      sunday_pm: boolean
      other: string
    }
    bringing_script?: boolean
    meeting_committee?: string
    day?: string
    time_slot?: string
    previous_experience?: boolean
    group_name?: string
    committee?: string
    willing_to_serve?: boolean
    panels?: string[]  // For entertainment volunteers
    comments: string
  }
  created_at: string
}

// Define sort configuration type
interface SortConfig {
  key: keyof VolunteerInterest | "interests" | "timeSlots"
  direction: "asc" | "desc"
}

export default function VolunteerInterestPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [volunteerData, setVolunteerData] = useState<VolunteerInterest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<VolunteerInterestTab>(
    VolunteerInterestTab.GENERAL
  )

  // Independent sort configurations for each table
  const [generalSortConfig, setGeneralSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc"
  })
  const [marathonSortConfig, setMarathonSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc"
  })
  const [hospitalitySortConfig, setHospitalitySortConfig] =
    useState<SortConfig>({
      key: "created_at",
      direction: "desc"
    })
  const [outreachSortConfig, setOutreachSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc"
  })
  const [merchSortConfig, setMerchSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc"
  })

  const [hasAccessToSensitiveData, setHasAccessToSensitiveData] =
    useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [conferenceDates, setConferenceDates] = useState<string[]>([])
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>(["all"])
  const [dayFilter, setDayFilter] = useState<string[]>(["all"])
  const [timeSlotFilter, setTimeSlotFilter] = useState<string[]>(["all"])
  
  // Edit modal state
  const [editingVolunteer, setEditingVolunteer] = useState<VolunteerInterest | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: "",
    last_initial: "",
    email: "",
    phone: "",
    status: "pending"
  })
  
  // Populate edit form when a volunteer is selected for editing
  useEffect(() => {
    if (editingVolunteer) {
      setEditFormData({
        name: editingVolunteer.name || "",
        last_initial: editingVolunteer.last_initial || "",
        email: editingVolunteer.email || "",
        phone: editingVolunteer.phone || "",
        status: editingVolunteer.status || "pending"
      })
    }
  }, [editingVolunteer])
  
  // Security time slot management state
  const [securityAssignments, setSecurityAssignments] = useState<any[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)
  
  // Greeter data state
  const [greeterData, setGreeterData] = useState<any[]>([])
  const [loadingGreeters, setLoadingGreeters] = useState(false)
  
  // Cleanup data state
  const [cleanupData, setCleanupData] = useState<any[]>([])
  const [loadingCleanup, setLoadingCleanup] = useState(false)

  const { toast } = useToast()
  const conferenceDayOptions = conferenceDates.flatMap((date) => {
    const parsedDate = new Date(`${date}T00:00:00`)
    if (Number.isNaN(parsedDate.getTime())) return []

    return [
      parsedDate.toLocaleDateString("en-US", { weekday: "long" }),
      parsedDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      })
    ]
  })

  // Set active tab based on URL parameters
  useEffect(() => {
    const tab = searchParams.get("tab") as VolunteerInterestTab
    if (tab && Object.values(VolunteerInterestTab).includes(tab)) {
      setActiveTab(tab)
    } else {
      setActiveTab(VolunteerInterestTab.GENERAL)
    }
  }, [searchParams])

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const newTab = value as VolunteerInterestTab
    router.push(`/host/volunteer-interest?tab=${newTab}`)
    setActiveTab(newTab)
  }

  useEffect(() => {
    async function loadVolunteerInterest() {
      try {
        setLoading(true)
        // Load all volunteer interest data at once
        const result = await getVolunteerInterest()
        const dates = await getCurrentConferenceDates()
        setVolunteerData(result.data || [])
        setHasAccessToSensitiveData(result.hasAccessToSensitive)
        setCanEdit(result.canEdit || false)
        setConferenceDates(dates)
        setLoading(false)
      } catch (error) {
        console.error("Error loading volunteer interest data:", error)
        toast({
          title: "Error",
          description: "Failed to load volunteer interest data.",
          variant: "destructive"
        })
        setLoading(false)
      }
    }

    loadVolunteerInterest()
  }, [toast])
  
  // Load security time slot assignments when security tab is active
  useEffect(() => {
    async function loadSecurityAssignments() {
      if (activeTab === VolunteerInterestTab.SECURITY && canEdit) {
        try {
          setLoadingAssignments(true)
          const assignments = await getSecurityTimeSlotAssignments()
          setSecurityAssignments(assignments)
        } catch (error) {
          console.error("Error loading security assignments:", error)
          toast({
            title: "Error",
            description: "Failed to load security time slot assignments.",
            variant: "destructive"
          })
        } finally {
          setLoadingAssignments(false)
        }
      }
    }
    
    loadSecurityAssignments()
  }, [activeTab, canEdit, toast])
  
  // Load greeter data when greeter tab is active
  useEffect(() => {
    async function loadGreeterData() {
      if (activeTab === VolunteerInterestTab.GREETER) {
        try {
          setLoadingGreeters(true)
          const greeters = await getGreeterVolunteers()
          setGreeterData(greeters)
        } catch (error) {
          console.error("Error loading greeter data:", error)
          toast({
            title: "Error",
            description: "Failed to load greeter data.",
            variant: "destructive"
          })
        } finally {
          setLoadingGreeters(false)
        }
      }
    }
    
    loadGreeterData()
  }, [activeTab, toast])
  
  // Load cleanup data when cleanup tab is active
  useEffect(() => {
    async function loadCleanupData() {
      if (activeTab === VolunteerInterestTab.CLEANUP) {
        try {
          setLoadingCleanup(true)
          const cleanupVolunteers = await getCleanupVolunteers()
          setCleanupData(cleanupVolunteers)
        } catch (error) {
          console.error("Error loading cleanup data:", error)
          toast({
            title: "Error",
            description: "Failed to load cleanup data.",
            variant: "destructive"
          })
        } finally {
          setLoadingCleanup(false)
        }
      }
    }
    
    loadCleanupData()
  }, [activeTab, toast])

  // Filter volunteer data by type, search query, and status
  const getVolunteersByType = (
    type: "general" | "marathon" | "hospitality" | "outreach" | "merch" | "registration" | "security" | "greeter" | "cleanup" | "entertainment"
  ) => {
    return volunteerData.filter((volunteer) => {
      // Type filter
      if (volunteer.type !== type) return false
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = volunteer.name.toLowerCase().includes(query)
        const matchesEmail = volunteer.email?.toLowerCase().includes(query)
        const matchesPhone = volunteer.phone?.includes(query)
        const matchesComments = volunteer.data.comments?.toLowerCase().includes(query)
        
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesComments) {
          return false
        }
      }
      
      // Status filter
      if (!statusFilter.includes("all") && !statusFilter.includes(volunteer.status || "pending")) {
        return false
      }
      
      // Day filter (for types that have day field)
      if (!dayFilter.includes("all")) {
        const volunteerDay = volunteer.data.day
        if (volunteerDay && !dayFilter.includes(volunteerDay)) {
          return false
        }
      }
      
      // Time slot filter (for types that have time_slot field)
      if (!timeSlotFilter.includes("all")) {
        const volunteerTimeSlot = volunteer.data.time_slot
        if (volunteerTimeSlot && !timeSlotFilter.includes(volunteerTimeSlot)) {
          return false
        }
      }
      
      return true
    })
  }

  // Get the sort config for the specified table type
  const getSortConfig = (
    type: "general" | "marathon" | "hospitality" | "outreach" | "merch" | "registration" | "security" | "greeter" | "cleanup" | "entertainment"
  ): SortConfig => {
    if (type === "general") return generalSortConfig
    if (type === "marathon") return marathonSortConfig
    if (type === "hospitality") return hospitalitySortConfig
    if (type === "outreach") return outreachSortConfig
    if (type === "merch") return merchSortConfig
    // For new types, use general sort config as default
    return generalSortConfig
  }

  // Sort the volunteer data based on the sort config for the given type
  const getSortedVolunteers = (
    type: "general" | "marathon" | "hospitality" | "outreach" | "merch" | "registration" | "security" | "greeter" | "cleanup" | "entertainment"
  ) => {
    const volunteers = getVolunteersByType(type)
    const sortConfig = getSortConfig(type)

    return [...volunteers].sort((a, b) => {
      if (sortConfig.key === "created_at") {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA
      }

      if (sortConfig.key === "interests" && type === "general") {
        // Count number of interests
        const interestsA = a.data.interests
          ? Object.values(a.data.interests).filter(Boolean).length
          : 0
        const interestsB = b.data.interests
          ? Object.values(b.data.interests).filter(Boolean).length
          : 0
        return sortConfig.direction === "asc"
          ? interestsA - interestsB
          : interestsB - interestsA
      }

      if (sortConfig.key === "timeSlots" && type === "general") {
        // Count number of time slots
        const timeSlotsA = a.data.time_slots
          ? Object.entries(a.data.time_slots).filter(
              ([key, value]) => key !== "other" && value === true
            ).length
          : 0
        const timeSlotsB = b.data.time_slots
          ? Object.entries(b.data.time_slots).filter(
              ([key, value]) => key !== "other" && value === true
            ).length
          : 0
        return sortConfig.direction === "asc"
          ? timeSlotsA - timeSlotsB
          : timeSlotsB - timeSlotsA
      }

      // For basic string properties
      const valA = a[sortConfig.key as keyof VolunteerInterest] as string
      const valB = b[sortConfig.key as keyof VolunteerInterest] as string

      return sortConfig.direction === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA)
    })
  }

  // Function to handle sorting when a column header is clicked
  const handleSort = (
    key: keyof VolunteerInterest | "interests" | "timeSlots",
    type: "general" | "marathon" | "hospitality" | "outreach" | "merch" | "registration" | "security" | "registration" | "security"
  ) => {
    const currentConfig = getSortConfig(type)
    const newDirectionValue =
      currentConfig.key === key && currentConfig.direction === "asc"
        ? ("desc" as const)
        : ("asc" as const)

    const newConfig: SortConfig = {
      key,
      direction: newDirectionValue
    }

    // Update the appropriate sort config
    if (type === "general") {
      setGeneralSortConfig(newConfig)
    } else if (type === "marathon") {
      setMarathonSortConfig(newConfig)
    } else if (type === "hospitality") {
      setHospitalitySortConfig(newConfig)
    } else if (type === "outreach") {
      setOutreachSortConfig(newConfig)
    } else {
      setMerchSortConfig(newConfig)
    }
  }

  // Function to render sort indicator
  const renderSortIndicator = (
    key: keyof VolunteerInterest | "interests" | "timeSlots",
    type: "general" | "marathon" | "hospitality" | "outreach" | "merch" | "registration" | "security" | "registration" | "security"
  ) => {
    const sortConfig = getSortConfig(type)
    if (sortConfig.key !== key) return null

    return sortConfig.direction === "asc" ? (
      <ArrowUp className="inline ml-1 h-4 w-4" />
    ) : (
      <ArrowDown className="inline ml-1 h-4 w-4" />
    )
  }

  // Function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  }

  // Function to handle status change
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateVolunteerStatus(id, newStatus)

      // Update local state
      setVolunteerData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: newStatus } : item
        )
      )

      toast({
        title: "Status Updated",
        description: "Volunteer status has been updated successfully."
      })
    } catch (error) {
      console.error("Error updating status:", error)
      toast({
        title: "Error",
        description: "Failed to update volunteer status.",
        variant: "destructive"
      })
    }
  }
  
  // Function to handle volunteer deletion
  const handleDelete = async (id: string) => {
    try {
      const result = await deleteVolunteerInterest(id)
      
      if (result.success) {
        // Remove from local state
        setVolunteerData((prev) => {
          const filtered = prev.filter((item) => item.id !== id)
          console.log(`Deleted volunteer ${id}. Remaining count: ${filtered.length}`)
          return filtered
        })
        
        toast({
          title: "Deleted",
          description: "Volunteer record has been deleted successfully."
        })
      } else {
        throw new Error("Delete operation failed")
      }
    } catch (error) {
      console.error("Error deleting volunteer:", error)
      toast({
        title: "Error",
        description: "Failed to delete volunteer record.",
        variant: "destructive"
      })
    }
  }
  
  // Function to handle volunteer edit
  const handleEdit = async () => {
    if (!editingVolunteer) return
    
    try {
      // Check if this is a greeter volunteer
      if (editingVolunteer.type === "greeter") {
        const result = await updateGreeterVolunteer(editingVolunteer.id, editFormData)
        
        if (result.success) {
          // Reload greeter data
          const greeters = await getGreeterVolunteers()
          setGreeterData(greeters)
          
          toast({
            title: "Updated",
            description: "Greeter volunteer has been updated successfully."
          })
        } else {
          throw new Error(result.error)
        }
      } else if (editingVolunteer.type === "cleanup") {
        const result = await updateCleanupVolunteer(editingVolunteer.id, editFormData)
        
        if (result.success) {
          // Reload cleanup data
          const cleanupVolunteers = await getCleanupVolunteers()
          setCleanupData(cleanupVolunteers)
          
          toast({
            title: "Updated",
            description: "Cleanup volunteer has been updated successfully."
          })
        } else {
          throw new Error(result.error)
        }
      } else {
        await updateVolunteerInterest(editingVolunteer.id, editFormData)
        
        // Update local state
        setVolunteerData((prev) =>
          prev.map((item) =>
            item.id === editingVolunteer.id 
              ? { ...item, ...editFormData, last_initial: editFormData.last_initial }
              : item
          )
        )
        
        toast({
          title: "Updated",
          description: "Volunteer record has been updated successfully."
        })
      }
      
      setEditingVolunteer(null)
    } catch (error) {
      console.error("Error updating volunteer:", error)
      toast({
        title: "Error",
        description: "Failed to update volunteer record.",
        variant: "destructive"
      })
    }
  }
  
  // Handle adding a volunteer to a time slot
  const handleAddTimeSlotAssignment = async (
    volunteerId: string, 
    day: string, 
    block: string, 
    slot: string
  ) => {
    const volunteer = volunteerData.find(v => v.id === volunteerId)
    if (!volunteer) return
    
    const volunteerName = `${volunteer.name} ${volunteer.last_initial}`
    
    await addSecurityTimeSlotAssignment(volunteerId, volunteerName, day, block, slot)
    
    // Reload assignments
    const assignments = await getSecurityTimeSlotAssignments()
    setSecurityAssignments(assignments)
  }
  
  // Handle removing a volunteer from a time slot
  const handleRemoveTimeSlotAssignment = async (assignmentId: string) => {
    await removeSecurityTimeSlotAssignment(assignmentId)
    
    // Reload assignments
    const assignments = await getSecurityTimeSlotAssignments()
    setSecurityAssignments(assignments)
  }

  // Function to get interest badges
  const getInterestBadges = (
    interests?: VolunteerInterest["data"]["interests"]
  ) => {
    if (!interests) return <span className="text-muted-foreground">None</span>

    return (
      <div className="flex flex-wrap gap-1">
        {Object.entries(interests).map(([key, value]) => {
          if (!value) return null

          let label = ""
          let icon = null
          switch (key) {
            case "greeter":
              label = "Greeter"
              icon = (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-hand-raised"
                >
                  <path d="M14 9l-8.2 8.2c-.8.8-2 .8-2.8 0l-1.2-1.2c-.8-.8-.8-2 0-2.8L12 3c1.1-1.1 2.9-1.1 4 0l4 4c1.1 1.1 1.1 2.9 0 4l-9.7 9.7c-.8.8-2 .8-2.8 0l-1.2-1.2c-.8-.8-.8-2 0-2.8l8.2-8.2" />
                </svg>
              )
              break
            case "security":
              label = "Security"
              icon = (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-shield-check"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              )
              break
            case "cleanup":
              label = "Cleanup"
              icon = (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-trash-2"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
              )
              break
            case "setup":
              label = "Setup"
              icon = (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-hammer"
                >
                  <path d="M11.3 6.2 3 14.5c-.7.7-.7 1.9 0 2.6l3.9 3.9c.7.7 1.9.7 2.6 0l8.3-8.3" />
                  <path d="m15 5 2 2" />
                  <path d="M17.8 2.2 16 4l2 2 1.8-1.8c.5-.5.5-1.3 0-1.8l-.2-.2c-.5-.5-1.3-.5-1.8 0Z" />
                </svg>
              )
              break
            case "host_committee":
              label = "Host Committee"
              icon = (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-users"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              )
              break
            case "wherever_needed":
              label = "Wherever Needed"
              icon = (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-sparkles"
                >
                  <path d="m12 3-1.9 5.7a2 2 0 0 1-1.9 1.3H3l5.3 3.9c.8.6 1.1 1.6.8 2.5l-1.9 5.7 5.3-3.9c.8-.6 1.9-.6 2.7 0l5.3 3.9-1.9-5.7c-.3-.9 0-1.9.8-2.5L24 10h-5.2a2 2 0 0 1-1.9-1.3z" />
                </svg>
              )
              break
            default:
              label = key
          }

          return (
            <Badge
              key={key}
              variant="secondary"
              className="whitespace-nowrap flex items-center gap-1"
            >
              {icon}
              {label}
            </Badge>
          )
        })}
      </div>
    )
  }

  // Function to get time slot badges
  const getTimeSlotBadges = (
    timeSlots?: VolunteerInterest["data"]["time_slots"]
  ) => {
    if (!timeSlots) return <span className="text-muted-foreground">None</span>

    const selectedSlots = Object.entries(timeSlots).filter(
      ([key, value]) => key !== "other" && value === true
    )

    if (selectedSlots.length === 0 && !timeSlots.other) {
      return <span className="text-muted-foreground">None</span>
    }

    return (
      <div className="flex flex-wrap gap-1">
        {selectedSlots.map(([key]) => {
          let label = ""
          const icon = (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-clock"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )

          switch (key) {
            case "thursday_pm":
              label = "Thu PM"
              break
            case "friday_am":
              label = "Fri AM"
              break
            case "friday_midday":
              label = "Fri Midday"
              break
            case "friday_pm":
              label = "Fri PM"
              break
            case "saturday_am":
              label = "Sat AM"
              break
            case "saturday_midday":
              label = "Sat Midday"
              break
            case "saturday_pm":
              label = "Sat PM"
              break
            case "sunday_am":
              label = "Sun AM"
              break
            case "sunday_midday":
              label = "Sun Midday"
              break
            case "sunday_pm":
              label = "Sun PM"
              break
            default:
              label = key
          }

          return (
            <Badge
              key={key}
              variant="outline"
              className="whitespace-nowrap flex items-center gap-1"
            >
              {icon}
              {label}
            </Badge>
          )
        })}

        {timeSlots.other && (
          <Badge
            variant="outline"
            className="whitespace-nowrap flex items-center gap-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-plus-circle"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8" />
              <path d="M12 8v8" />
            </svg>
            Other: {timeSlots.other}
          </Badge>
        )}
      </div>
    )
  }

  // Function to render comments
  const renderComments = (volunteer: VolunteerInterest) => {
    if (!volunteer.data.comments) {
      return <span className="text-muted-foreground">None</span>
    }

    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <MessageSquare className="h-4 w-4 mr-1" />
            View
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Volunteer Comments</DialogTitle>
            <DialogDescription>
              From {volunteer.name} {volunteer.last_initial}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-4 bg-muted rounded-md whitespace-pre-wrap">
            {volunteer.data.comments}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Function to render a volunteer table
  const renderVolunteerTable = (
    type: "general" | "marathon" | "hospitality" | "outreach" | "merch" | "registration" | "security" | "registration" | "security",
    title: string
  ) => {
    const volunteers = getSortedVolunteers(type)

    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("name", type)}
                      >
                        Name {renderSortIndicator("name", type)}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("last_initial", type)}
                      >
                        Last Initial {renderSortIndicator("last_initial", type)}
                      </TableHead>
                      {hasAccessToSensitiveData && (
                        <TableHead className="whitespace-nowrap">
                          Contact Info
                        </TableHead>
                      )}

                      {/* Type-specific columns */}
                      {type === "general" && (
                        <>
                          <TableHead
                            className="cursor-pointer whitespace-nowrap"
                            onClick={() => handleSort("interests", type)}
                          >
                            Interests {renderSortIndicator("interests", type)}
                          </TableHead>
                          <TableHead
                            className="cursor-pointer whitespace-nowrap"
                            onClick={() => handleSort("timeSlots", type)}
                          >
                            Time Slots {renderSortIndicator("timeSlots", type)}
                          </TableHead>
                        </>
                      )}
                      
                      {type === "registration" && (
                        <TableHead className="whitespace-nowrap">
                          Time Slots
                        </TableHead>
                      )}
                      
                      {type === "security" && (
                        <TableHead className="whitespace-nowrap">
                          Time Blocks
                        </TableHead>
                      )}

                      {type === "marathon" && (
                        <>
                          <TableHead className="whitespace-nowrap">
                            Day
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Time Slot
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Bringing Script
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Meeting/Committee
                          </TableHead>
                        </>
                      )}

                      {type === "hospitality" && (
                        <>
                          <TableHead className="whitespace-nowrap">
                            Day
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Time Slot
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Previous Experience
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Group/Meeting
                          </TableHead>
                        </>
                      )}

                      {type === "outreach" && (
                        <>
                          <TableHead className="whitespace-nowrap">
                            Committee/Table Name
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Willing to Serve
                          </TableHead>
                        </>
                      )}

                      {type === "merch" && (
                        <>
                          <TableHead className="whitespace-nowrap">
                            Day
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Time Slot
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Previous Experience
                          </TableHead>
                        </>
                      )}

                      <TableHead className="whitespace-nowrap">
                        Comments
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("status", type)}
                      >
                        Status {renderSortIndicator("status", type)}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("created_at", type)}
                      >
                        Submitted {renderSortIndicator("created_at", type)}
                      </TableHead>
                      {canEdit && (
                        <TableHead className="whitespace-nowrap">
                          Actions
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {volunteers.length > 0 ? (
                      volunteers.map((volunteer) => (
                        <TableRow key={volunteer.id}>
                          <TableCell>{volunteer.name}</TableCell>
                          <TableCell>{volunteer.last_initial}</TableCell>
                          {hasAccessToSensitiveData && (
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {volunteer.email && (
                                  <Badge
                                    variant="outline"
                                    className="whitespace-nowrap flex items-center gap-1"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="lucide lucide-mail"
                                    >
                                      <rect
                                        width="20"
                                        height="16"
                                        x="2"
                                        y="4"
                                        rx="2"
                                      />
                                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                    </svg>
                                    {volunteer.email}
                                  </Badge>
                                )}
                                {volunteer.phone && (
                                  <Badge
                                    variant="outline"
                                    className="whitespace-nowrap flex items-center gap-1"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      className="lucide lucide-phone"
                                    >
                                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                    {volunteer.phone}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}

                          {/* Type-specific columns */}
                          {type === "general" && (
                            <>
                              <TableCell>
                                {getInterestBadges(volunteer.data.interests)}
                              </TableCell>
                              <TableCell>
                                {getTimeSlotBadges(volunteer.data.time_slots)}
                              </TableCell>
                            </>
                          )}
                          
                          {type === "registration" && (
                            <>
                              <TableCell>
                                {volunteer.data.time_slots && Array.isArray(volunteer.data.time_slots) ? (
                                  <div className="flex flex-wrap gap-1">
                                    {volunteer.data.time_slots.map((slot: string) => (
                                      <Badge key={slot} variant="outline" className="text-xs">
                                        {slot.replace(/_/g, ' ').replace(/thursday|friday|saturday|sunday/i, (match) => 
                                          match.charAt(0).toUpperCase() + match.slice(1)
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">None</span>
                                )}
                              </TableCell>
                            </>
                          )}
                          
                          {type === "security" && (
                            <>
                              <TableCell>
                                {volunteer.data.time_slots && Array.isArray(volunteer.data.time_slots) ? (
                                  <div className="flex flex-wrap gap-1">
                                    {volunteer.data.time_slots.map((slot: string) => (
                                      <Badge key={slot} variant="outline" className="text-xs whitespace-nowrap">
                                        {slot.replace(/_/g, ' ').replace(/thursday|friday|saturday|sunday/i, (match) => 
                                          match.charAt(0).toUpperCase() + match.slice(1)
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">None</span>
                                )}
                              </TableCell>
                            </>
                          )}

                          {type === "marathon" && (
                            <>
                              <TableCell>{volunteer.data.day}</TableCell>
                              <TableCell>{volunteer.data.time_slot}</TableCell>
                              <TableCell>
                                {volunteer.data.bringing_script ? "Yes" : "No"}
                              </TableCell>
                              <TableCell>
                                {volunteer.data.meeting_committee || (
                                  <span className="text-muted-foreground">
                                    None
                                  </span>
                                )}
                              </TableCell>
                            </>
                          )}

                          {type === "hospitality" && (
                            <>
                              <TableCell>{volunteer.data.day}</TableCell>
                              <TableCell>{volunteer.data.time_slot}</TableCell>
                              <TableCell>
                                {volunteer.data.previous_experience
                                  ? "Yes"
                                  : "No"}
                              </TableCell>
                              <TableCell>
                                {volunteer.data.group_name || (
                                  <span className="text-muted-foreground">
                                    None
                                  </span>
                                )}
                              </TableCell>
                            </>
                          )}

                          {type === "outreach" && (
                            <>
                              <TableCell>
                                {volunteer.data.committee || (
                                  <span className="text-muted-foreground">
                                    None
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {volunteer.data.willing_to_serve ? "Yes" : "No"}
                              </TableCell>
                            </>
                          )}

                          {type === "merch" && (
                            <>
                              <TableCell>{volunteer.data.day}</TableCell>
                              <TableCell>{volunteer.data.time_slot}</TableCell>
                              <TableCell>
                                {volunteer.data.previous_experience
                                  ? "Yes"
                                  : "No"}
                              </TableCell>
                            </>
                          )}

                          <TableCell>{renderComments(volunteer)}</TableCell>
                          <TableCell>
                            <Select
                              value={volunteer.status || "pending"}
                              onValueChange={(value) =>
                                handleStatusChange(volunteer.id, value)
                              }
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="contacted">
                                  Contacted
                                </SelectItem>
                                <SelectItem value="assigned">
                                  Assigned
                                </SelectItem>
                                <SelectItem value="completed">
                                  Completed
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {formatDate(volunteer.created_at)}
                          </TableCell>
                          {canEdit && (
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingVolunteer(volunteer)
                                    setEditFormData({
                                      name: volunteer.name,
                                      last_initial: volunteer.last_initial,
                                      email: volunteer.email || "",
                                      phone: volunteer.phone || "",
                                      status: volunteer.status || "pending"
                                    })
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Volunteer Record</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete the volunteer record for {volunteer.name} {volunteer.last_initial}? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(volunteer.id)}
                                        className="bg-destructive hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={
                            type === "general"
                              ? hasAccessToSensitiveData
                                ? 9
                                : 8
                              : type === "registration"
                                ? hasAccessToSensitiveData
                                  ? 6
                                  : 5
                              : type === "security"
                                ? hasAccessToSensitiveData
                                  ? 6
                                  : 5
                              : type === "outreach"
                                ? hasAccessToSensitiveData
                                  ? 7
                                  : 6
                                : hasAccessToSensitiveData
                                  ? 9
                                  : 8
                          }
                          className="text-center py-6"
                        >
                          No volunteer interest data found.
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
    )
  }

  const renderEntertainmentTable = () => {
    const volunteers = getSortedVolunteers("entertainment")
    
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Entertainment Volunteers</CardTitle>
              <CardDescription className="mt-2">
                Volunteers who signed up to help with entertainment panels
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {hasAccessToSensitiveData && (
                    <>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                    </>
                  )}
                  <TableHead>Selected Panels</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  {canEdit && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteers.length > 0 ? (
                  volunteers.map((volunteer) => {
                    // Parse panels - they are stored as full strings with panel info
                    const panels = volunteer.data.panels || []
                    const panelDisplay = panels.length > 0 
                      ? panels.join('; ') 
                      : 'No panels selected'
                    
                    return (
                      <TableRow key={volunteer.id}>
                        <TableCell className="font-medium">
                          {volunteer.name} {volunteer.last_initial}.
                        </TableCell>
                        {hasAccessToSensitiveData && (
                          <>
                            <TableCell>{volunteer.email || "-"}</TableCell>
                            <TableCell>{volunteer.phone || "-"}</TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="max-w-md">
                            <span className="text-sm">{panelDisplay}</span>
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {panels.length} panel{panels.length !== 1 ? 's' : ''} selected
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md truncate">
                            {volunteer.data.comments || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={volunteer.status === "approved" ? "default" : "secondary"}>
                            {volunteer.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(volunteer.created_at).toLocaleDateString()}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingVolunteer(volunteer)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Volunteer</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete {volunteer.name} {volunteer.last_initial}.&apos;s volunteer interest? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(volunteer.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={hasAccessToSensitiveData ? (canEdit ? 8 : 7) : (canEdit ? 6 : 5)}
                      className="text-center py-6"
                    >
                      No entertainment volunteer data found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Volunteer Interest</h1>
      
      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by name, email, phone, or comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <Select 
          value={statusFilter.includes("all") ? "all" : statusFilter[0] || "all"} 
          onValueChange={(value) => setStatusFilter([value])}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        
        <Select 
          value={dayFilter.includes("all") ? "all" : dayFilter[0] || "all"} 
          onValueChange={(value) => setDayFilter([value])}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by day" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Days</SelectItem>
            {conferenceDayOptions.map((day) => (
              <SelectItem key={day} value={day}>
                {day}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select 
          value={timeSlotFilter.includes("all") ? "all" : timeSlotFilter[0] || "all"} 
          onValueChange={(value) => setTimeSlotFilter([value])}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Times</SelectItem>
            <SelectItem value="7am-9am">7am-9am</SelectItem>
            <SelectItem value="9am-11am">9am-11am</SelectItem>
            <SelectItem value="11am-1pm">11am-1pm</SelectItem>
            <SelectItem value="1pm-3pm">1pm-3pm</SelectItem>
            <SelectItem value="3pm-5pm">3pm-5pm</SelectItem>
            <SelectItem value="5pm-7:30pm">5pm-7:30pm</SelectItem>
            <SelectItem value="7:30pm-9:30pm">7:30pm-9:30pm</SelectItem>
            <SelectItem value="9:30pm-10:30pm">9:30pm-10:30pm</SelectItem>
            <SelectItem value="10:30pm-12am">10:30pm-12am</SelectItem>
            <SelectItem value="Overnight">Overnight</SelectItem>
            <SelectItem value="Morning">Morning</SelectItem>
            <SelectItem value="Afternoon">Afternoon</SelectItem>
            <SelectItem value="Evening">Evening</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="inline-flex flex-col md:flex-row w-full h-auto">
          <TabsTrigger value={VolunteerInterestTab.GENERAL} className="flex-1">
            General Interest
          </TabsTrigger>
          <TabsTrigger value={VolunteerInterestTab.REGISTRATION} className="flex-1">
            Registration
          </TabsTrigger>
          <TabsTrigger value={VolunteerInterestTab.SECURITY} className="flex-1">
            Security
          </TabsTrigger>
          <TabsTrigger value={VolunteerInterestTab.MARATHON} className="flex-1">
            Marathon Meeting
          </TabsTrigger>
          <TabsTrigger
            value={VolunteerInterestTab.HOSPITALITY}
            className="flex-1"
          >
            Hospitality
          </TabsTrigger>
          <TabsTrigger value={VolunteerInterestTab.OUTREACH} className="flex-1">
            Outreach
          </TabsTrigger>
          <TabsTrigger value={VolunteerInterestTab.MERCH} className="flex-1">
            Merch
          </TabsTrigger>
          <TabsTrigger value={VolunteerInterestTab.GREETER} className="flex-1">
            Greeter
          </TabsTrigger>
          <TabsTrigger value={VolunteerInterestTab.CLEANUP} className="flex-1">
            Cleanup
          </TabsTrigger>
          <TabsTrigger value={VolunteerInterestTab.ENTERTAINMENT} className="flex-1">
            Entertainment
          </TabsTrigger>
        </TabsList>

        <TabsContent value={VolunteerInterestTab.GENERAL} className="mt-6">
          {renderVolunteerTable("general", "General Volunteer Interest")}
        </TabsContent>
        
        <TabsContent value={VolunteerInterestTab.REGISTRATION} className="mt-6">
          {renderVolunteerTable("registration", "Registration Desk Volunteers")}
        </TabsContent>
        
        <TabsContent value={VolunteerInterestTab.SECURITY} className="mt-6">
          <div className="space-y-6">
            {renderVolunteerTable("security", "Security Volunteers")}
            
            {/* Time Slot Management Section - Only show if user can edit */}
            {canEdit && (
              <Card>
                <CardHeader>
                  <CardTitle>Time Slot Assignments</CardTitle>
                  <CardDescription>
                    Manage 2-hour time slot assignments for security volunteers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAssignments ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="animate-spin h-8 w-8 text-primary" />
                    </div>
                  ) : (
                    <SecurityTimeSlotManager
                      volunteers={getVolunteersByType("security").map(v => ({
                        id: v.id,
                        name: v.name,
                        last_initial: v.last_initial,
                        phone: v.phone || undefined,
                        email: v.email || undefined,
                        timeSlots: v.data.time_slots && Array.isArray(v.data.time_slots) 
                          ? v.data.time_slots 
                          : []
                      }))}
                      assignments={securityAssignments}
                      onAddAssignment={handleAddTimeSlotAssignment}
                      onRemoveAssignment={handleRemoveTimeSlotAssignment}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value={VolunteerInterestTab.MARATHON} className="mt-6">
          {renderVolunteerTable("marathon", "Marathon Meeting Signups")}
        </TabsContent>

        <TabsContent value={VolunteerInterestTab.HOSPITALITY} className="mt-6">
          {renderVolunteerTable("hospitality", "Hospitality Volunteers")}
        </TabsContent>

        <TabsContent value={VolunteerInterestTab.OUTREACH} className="mt-6">
          {renderVolunteerTable("outreach", "Outreach Volunteers")}
        </TabsContent>

        <TabsContent value={VolunteerInterestTab.MERCH} className="mt-6">
          {renderVolunteerTable("merch", "Merch Volunteers")}
        </TabsContent>
        
        <TabsContent value={VolunteerInterestTab.GREETER} className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Greeter Volunteers</CardTitle>
                  <CardDescription className="mt-2">
                    Manage greeter volunteers imported from spreadsheets
                  </CardDescription>
                </div>
                {canEdit && (
                  <GreeterUpload
                    conferenceDates={conferenceDates}
                    onUploadSuccess={async (entries) => {
                      const result = await upsertGreeterVolunteers(entries)
                      
                      if (result.errors.length > 0) {
                        toast({
                          title: "Partial Success",
                          description: `Inserted: ${result.inserted}, Updated: ${result.updated}, Errors: ${result.errors.length}`,
                          variant: "destructive"
                        })
                      } else {
                        toast({
                          title: "Success",
                          description: `Inserted: ${result.inserted}, Updated: ${result.updated} greeter entries`
                        })
                      }
                      
                      // Reload greeter data
                      const greeters = await getGreeterVolunteers()
                      setGreeterData(greeters)
                    }}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingGreeters ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : greeterData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No greeter data loaded yet.</p>
                  {canEdit && (
                    <p className="text-sm mt-2">Use the upload button to import a greeter spreadsheet.</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Meeting</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      {canEdit && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {greeterData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {new Date(entry.data.day).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          {entry.name} {entry.last_initial || ""}
                        </TableCell>
                        <TableCell>{entry.data.room}</TableCell>
                        <TableCell className="whitespace-nowrap">{entry.data.time}</TableCell>
                        <TableCell>{entry.data.meeting || "-"}</TableCell>
                        <TableCell>{entry.phone || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              entry.status === "accepted" ? "default" :
                              entry.status === "declined" ? "destructive" :
                              entry.status === "maybe" ? "secondary" :
                              "outline"
                            }
                          >
                            {entry.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.data.notes || "-"}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingVolunteer(entry)
                                  setEditFormData({
                                    name: entry.name,
                                    last_initial: entry.last_initial,
                                    email: entry.email || "",
                                    phone: entry.phone || "",
                                    status: entry.status || "pending"
                                  })
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Greeter Volunteer?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete {entry.name} {entry.last_initial} from the greeter list.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        const result = await deleteGreeterVolunteer(entry.id)
                                        if (result.success) {
                                          toast({
                                            title: "Success",
                                            description: "Greeter volunteer deleted"
                                          })
                                          const greeters = await getGreeterVolunteers()
                                          setGreeterData(greeters)
                                        } else {
                                          toast({
                                            title: "Error",
                                            description: result.error || "Failed to delete greeter",
                                            variant: "destructive"
                                          })
                                        }
                                      }}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value={VolunteerInterestTab.CLEANUP} className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Cleanup Volunteers</CardTitle>
                  <CardDescription className="mt-2">
                    Manage cleanup volunteers imported from spreadsheets
                  </CardDescription>
                </div>
                {canEdit && (
                  <CleanupUpload
                    conferenceDates={conferenceDates}
                    onUploadSuccess={async (entries) => {
                      const result = await upsertCleanupVolunteers(entries)
                      
                      if (result.errors.length > 0) {
                        toast({
                          title: "Partial Success",
                          description: `Inserted: ${result.inserted}, Updated: ${result.updated}, Errors: ${result.errors.length}`,
                          variant: "destructive"
                        })
                      } else {
                        toast({
                          title: "Success",
                          description: `Inserted: ${result.inserted}, Updated: ${result.updated} cleanup entries`
                        })
                      }
                      
                      // Reload cleanup data
                      const cleanupVolunteers = await getCleanupVolunteers()
                      setCleanupData(cleanupVolunteers)
                    }}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingCleanup ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : cleanupData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No cleanup data loaded yet.</p>
                  {canEdit && (
                    <p className="text-sm mt-2">Use the upload button to import a cleanup spreadsheet.</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      {canEdit && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cleanupData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {entry.name} {entry.last_initial}
                        </TableCell>
                        <TableCell>{entry.data.location}</TableCell>
                        <TableCell>
                          {(() => {
                            const [year, month, day] = entry.data.date.split('-')
                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                            // Create date at noon to avoid timezone issues
                            const d = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0)
                            return `${dayNames[d.getDay()]} ${monthNames[d.getMonth()]} ${d.getDate()}`
                          })()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{entry.data.time}</TableCell>
                        <TableCell>{entry.phone || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              entry.status === "confirmed" ? "default" :
                              entry.status === "declined" ? "destructive" :
                              "outline"
                            }
                          >
                            {entry.status || "pending"}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingVolunteer(entry)
                                  setEditFormData({
                                    name: entry.name,
                                    last_initial: entry.last_initial,
                                    email: entry.email || "",
                                    phone: entry.phone || "",
                                    status: entry.status || "pending"
                                  })
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Cleanup Volunteer?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete {entry.name} {entry.last_initial} from the cleanup list.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={async () => {
                                        const result = await deleteCleanupVolunteer(entry.id)
                                        if (result.success) {
                                          toast({
                                            title: "Success",
                                            description: "Cleanup volunteer deleted"
                                          })
                                          const cleanupVolunteers = await getCleanupVolunteers()
                                          setCleanupData(cleanupVolunteers)
                                        } else {
                                          toast({
                                            title: "Error",
                                            description: result.error || "Failed to delete cleanup volunteer",
                                            variant: "destructive"
                                          })
                                        }
                                      }}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value={VolunteerInterestTab.ENTERTAINMENT} className="mt-6">
          {renderEntertainmentTable()}
        </TabsContent>
      </Tabs>
      
      {/* Edit Modal */}
      <Dialog open={!!editingVolunteer} onOpenChange={(open) => !open && setEditingVolunteer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Volunteer Record</DialogTitle>
            <DialogDescription>
              Update volunteer information for {editingVolunteer?.name} {editingVolunteer?.last_initial}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-last-initial">Last Initial</Label>
              <Input
                id="edit-last-initial"
                value={editFormData.last_initial}
                onChange={(e) => setEditFormData(prev => ({ ...prev, last_initial: e.target.value }))}
                maxLength={1}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  {editingVolunteer?.type === "greeter" ? (
                    <>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="maybe">Maybe</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setEditingVolunteer(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
