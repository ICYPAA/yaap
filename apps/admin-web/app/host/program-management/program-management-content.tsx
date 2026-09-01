"use client"

import { useToast } from "@/components/hooks/use-toast"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
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
  DialogTitle
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  getConferenceState,
  setConferenceState,
  type ConferenceStatus
} from "@/lib/conference-state"
import {
  ArrowUpDown,
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  Edit,
  Filter,
  Languages,
  MapPin,
  MapPinned,
  Monitor,
  Palette,
  Plus,
  Search,
  Settings,
  Trash2,
  Utensils,
  Users,
  UserCheck,
  X
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import {
  createActivity,
  createEvent,
  createEventCategory,
  createFoodItem,
  createProgram,
  deleteActivity,
  deleteEvent,
  deleteEventCategory,
  deleteFoodItem,
  getActivities,
  getEventCategories,
  getEvents,
  getFoodItems,
  getPrograms,
  getVenue,
  updateActivity,
  updateEvent,
  updateEventCategory,
  updateFoodItem,
  updateProgram,
  updateVenue,
  type Activity,
  type Event,
  type EventCategory,
  type Food,
  type Program,
  type ProgramLocation,
  type Venue,
  type VenueAmenity,
  type VenueFloor
} from "./actions"

// Central Time utility functions
const CENTRAL_TIMEZONE = "America/Chicago"

// Parse date string as Central Time without timezone conversion
const parseDateAsCentral = (dateStr: string) => {
  if (!dateStr) return null

  try {
    // Handle different date formats
    if (dateStr.includes("T")) {
      // ISO format: "2024-01-15T14:30:00" or "2024-01-15T14:30:00Z" or "2024-01-15T14:30:00.000Z"
      const parts = dateStr.split("T")
      const datePart = parts[0]
      let timePart = parts[1] || "00:00:00"

      // Remove timezone suffix (Z, +00:00, etc.)
      timePart = timePart.replace(/[Z]|[+-]\d{2}:?\d{2}/, "")
      timePart = timePart.split(".")[0] // Remove milliseconds if present

      const [year, month, day] = datePart.split("-").map(Number)
      const [hour, minute, second = 0] = timePart.split(":").map(Number)

      // Validate parsed values
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null

      return {
        year,
        month,
        day,
        hour: hour || 0,
        minute: minute || 0,
        second: second || 0
      }
    } else if (dateStr.includes("-") && dateStr.split("-").length === 3) {
      // Date only: "2024-01-15"
      const [year, month, day] = dateStr.split("-").map(Number)

      // Validate parsed values
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null

      return { year, month, day, hour: 0, minute: 0, second: 0 }
    } else {
      // Try to create a Date object and extract parts
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return null

      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1, // Date.getMonth() is 0-indexed
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes(),
        second: date.getSeconds()
      }
    }
  } catch (error) {
    console.error("Error parsing date:", dateStr, error)
    return null
  }
}

// Format date for datetime-local input (Central Time)
const formatDateForInput = (dateStr: string) => {
  if (!dateStr) return ""

  const parsed = parseDateAsCentral(dateStr)
  if (!parsed) {
    console.error("Failed to parse date for input:", dateStr)
    return ""
  }

  try {
    const year = parsed.year.toString()
    const month = parsed.month.toString().padStart(2, "0")
    const day = parsed.day.toString().padStart(2, "0")
    const hours = (parsed.hour || 0).toString().padStart(2, "0")
    const minutes = (parsed.minute || 0).toString().padStart(2, "0")

    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch (error) {
    console.error("Error formatting date for input:", dateStr, parsed, error)
    return ""
  }
}

// Format date for display (Central Time)
const formatDateDisplay = (
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {}
) => {
  if (!dateStr) return ""

  const parsed = parseDateAsCentral(dateStr)
  if (!parsed) {
    console.error("Failed to parse date for display:", dateStr)
    return "Invalid Date"
  }

  try {
    // Create a date in Central Time for formatting
    const centralDate = new Date(
      parsed.year,
      parsed.month - 1, // Date constructor expects 0-indexed month
      parsed.day,
      parsed.hour,
      parsed.minute,
      parsed.second
    )

    // Validate the created date
    if (isNaN(centralDate.getTime())) {
      console.error("Invalid date created:", parsed)
      return "Invalid Date"
    }

    return centralDate.toLocaleDateString("en-US", {
      timeZone: CENTRAL_TIMEZONE,
      ...options
    })
  } catch (error) {
    console.error("Error formatting date for display:", dateStr, parsed, error)
    return "Invalid Date"
  }
}

// Convert 24-hour time to 12-hour format with AM/PM
const formatTime12Hour = (timeStr: string) => {
  if (!timeStr) return ""

  const [hourStr, minuteStr] = timeStr.split(":")
  const hour24 = parseInt(hourStr)
  const minute = minuteStr || "00"

  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
  const period = hour24 >= 12 ? "PM" : "AM"

  return `${hour12}:${minute} ${period}`
}

// Get weekday name for a date string (Central Time)
const getWeekdayFromDateString = (dateStr: string) => {
  if (!dateStr) return ""
  const parsed = parseDateAsCentral(dateStr)
  if (!parsed) return ""

  const centralDate = new Date(parsed.year, parsed.month - 1, parsed.day)
  return centralDate.toLocaleDateString("en-US", {
    timeZone: CENTRAL_TIMEZONE,
    weekday: "long"
  })
}

// Compare dates for sorting (Central Time)
const compareDates = (dateA: string, dateB: string) => {
  const parsedA = parseDateAsCentral(dateA)
  const parsedB = parseDateAsCentral(dateB)

  if (!parsedA || !parsedB) return 0

  // Compare year, month, day, hour, minute
  const valueA =
    parsedA.year * 100000000 +
    parsedA.month * 1000000 +
    parsedA.day * 10000 +
    parsedA.hour * 100 +
    parsedA.minute
  const valueB =
    parsedB.year * 100000000 +
    parsedB.month * 1000000 +
    parsedB.day * 10000 +
    parsedB.hour * 100 +
    parsedB.minute

  return valueA - valueB
}

// Form schemas
const programSchema = z.object({
  title: z.string().min(1, "Title is required").transform(val => val.trim()),
  description: z.string().min(1, "Description is required").transform(val => val.trim()),
  logo: z.string().optional().transform(val => val ? val.trim() : val),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  location_name: z.string().optional().transform(val => val ? val.trim() : val),
  location_street: z.string().optional().transform(val => val ? val.trim() : val),
  location_suite: z.string().optional().transform(val => val ? val.trim() : val),
  location_city: z.string().optional().transform(val => val ? val.trim() : val),
  location_state: z.string().optional().transform(val => val ? val.trim() : val),
  location_zip: z.string().optional().transform(val => val ? val.trim() : val),
  venue_rooms: z.array(z.string().transform(val => val.trim())).optional(),
  hospitality: z.string().optional().transform(val => val ? val.trim() : val),
  theme: z.string().optional().transform(val => val ? val.trim() : val),
  big_book_passage: z.string().optional().transform(val => val ? val.trim() : val),
  design: z.string().optional().transform(val => val ? val.trim() : val),
  promote: z.array(z.number()).optional(),
  content: z.string().optional().transform(val => val ? val.trim() : val)
})

const eventSchema = z.object({
  title: z.string().min(1, "Title is required").transform(val => val.trim()),
  description: z.string().min(1, "Description is required").transform(val => val.trim()),
  image: z.string().optional().transform(val => val ? val.trim() : val),
  date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location: z.string().min(1, "Location is required").transform(val => val.trim()),
  event_category_id: z.number().min(1, "Category is required"),
  can_save: z.boolean().default(false),
  asl: z.boolean().default(false),
  languages: z.array(z.string().transform(val => val.trim())).default([]),
  hybrid: z.boolean().default(false),
  speakers: z.array(z.string().transform(val => val.trim())).optional(),
  chairpeople: z.array(z.string().transform(val => val.trim())).optional(),
  program_id: z.number().min(1, "Program is required")
})

const categorySchema = z.object({
  title: z.string().min(1, "Title is required").transform(val => val.trim()),
  color: z.string().min(1, "Color is required").transform(val => val.trim()),
  program_id: z.number().min(1, "Program is required")
})

const foodSchema = z.object({
  category: z.string().min(1, "Category is required").transform(val => val.trim()),
  name: z.string().min(1, "Name is required").transform(val => val.trim()),
  description: z.string().min(1, "Description is required").transform(val => val.trim()),
  image: z.string().optional().nullable().transform(val => val ? val.trim() : val),
  location: z.string().min(1, "Location is required").transform(val => val.trim()),
  distance: z.number().optional().nullable(),
  menu: z.string().optional().nullable().transform(val => val ? val.trim() : val)
})

const activitySchema = z.object({
  category: z.string().min(1, "Category is required").transform(val => val.trim()),
  name: z.string().min(1, "Name is required").transform(val => val.trim()),
  description: z.string().min(1, "Description is required").transform(val => val.trim()),
  image: z.string().optional().nullable().transform(val => val ? val.trim() : val),
  location: z.string().min(1, "Location is required").transform(val => val.trim()),
  distance: z.number().optional().nullable()
})

const hospitalityTimeSchema = z.object({
  day: z.string().min(1, "Day is required").transform(val => val.trim()),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required")
})

const hospitalitySchema = z.object({
  location: z.string().min(1, "Location is required").transform(val => val.trim()),
  times: z.array(hospitalityTimeSchema)
})

const designColorsSchema = z.object({
  primary: z.string().min(1, "Primary color is required").transform(val => val.trim()),
  secondary: z.string().min(1, "Secondary color is required").transform(val => val.trim()),
  primaryDark: z.string().optional().transform(val => val ? val.trim() : val),
  secondaryDark: z.string().optional().transform(val => val ? val.trim() : val),
  info: z.string().optional().transform(val => val ? val.trim() : val),
  success: z.string().optional().transform(val => val ? val.trim() : val),
  warning: z.string().optional().transform(val => val ? val.trim() : val),
  error: z.string().optional().transform(val => val ? val.trim() : val)
})

const designSchema = z.object({
  colors: designColorsSchema
})

const faqItemSchema = z.object({
  question: z.string().min(1, "Question is required").transform(val => val.trim()),
  answer: z.string().min(1, "Answer is required").transform(val => val.trim())
})

const serviceSchema = z.object({
  title: z.string().min(1, "Title is required").transform(val => val.trim()),
  description: z.string().min(1, "Description is required").transform(val => val.trim()),
  internal_description: z.string().optional().transform(val => val ? val.trim() : val)
})

const volunteeringServiceSchema = serviceSchema.extend({
  signup_destination: z.enum(["internal", "external"]).default("internal"),
  external_signup_url: z.string().optional().transform(val => val ? val.trim() : val)
}).superRefine((service, context) => {
  if (service.signup_destination !== "external") return

  try {
    const url = new URL(service.external_signup_url || "")
    const isSignupGenius =
      url.hostname === "signupgenius.com" ||
      url.hostname.endsWith(".signupgenius.com") ||
      url.hostname === "sugeni.us" ||
      url.hostname.endsWith(".sugeni.us")

    if (
      url.protocol !== "https:" ||
      !isSignupGenius ||
      url.username ||
      url.password ||
      url.port
    ) {
      throw new Error("Untrusted SignUpGenius URL")
    }
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["external_signup_url"],
      message: "Enter a valid HTTPS SignUpGenius URL"
    })
  }
})

const contentSchema = z.object({
  faq: z.array(faqItemSchema),
  services: z.object({
    rides: serviceSchema.optional(),
    support: serviceSchema.optional(),
    hospitality: serviceSchema.optional(),
    volunteering: volunteeringServiceSchema.optional(),
    accessibility: serviceSchema.optional()
  })
})

type SortField = "title" | "date" | "start_time" | "location" | "category"
type SortOrder = "asc" | "desc"

interface FilterState {
  categories: string[]
  locations: string[]
  days: string[]
  times: string[]
}

export default function ProgramManagementContent() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)
  const [currentConferenceStatus, setCurrentConferenceStatus] =
    useState<ConferenceStatus>("none")
  const [currentConferenceProgramId, setCurrentConferenceProgramId] =
    useState<string>("none")
  const [savedCurrentProgramId, setSavedCurrentProgramId] =
    useState<number | null>(null)
  const [savingConferenceState, setSavingConferenceState] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [categories, setCategories] = useState<EventCategory[]>([])
  const [venue, setVenue] = useState<Venue | null>(null)
  const [foodItems, setFoodItems] = useState<Food[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
  const [filters, setFilters] = useState<FilterState>({
    categories: [],
    locations: [],
    days: [],
    times: []
  })
  const [showProgramDialog, setShowProgramDialog] = useState(false)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showPromotedEventsDialog, setShowPromotedEventsDialog] =
    useState(false)
  const [showHospitalityDialog, setShowHospitalityDialog] = useState(false)
  const [showDesignDialog, setShowDesignDialog] = useState(false)
  const [showContentDialog, setShowContentDialog] = useState(false)
  const [showVenueDialog, setShowVenueDialog] = useState(false)
  const [showFoodDialog, setShowFoodDialog] = useState(false)
  const [showActivityDialog, setShowActivityDialog] = useState(false)
  const [foodToEdit, setFoodToEdit] = useState<Food | null>(null)
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null)
  const [foodToDelete, setFoodToDelete] = useState<Food | null>(null)
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null)
  const [showDeleteFoodDialog, setShowDeleteFoodDialog] = useState(false)
  const [showDeleteActivityDialog, setShowDeleteActivityDialog] = useState(false)
  const [promotedEventsSearch, setPromotedEventsSearch] = useState("")
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)
  const [tempPromotedEvents, setTempPromotedEvents] = useState<number[]>([])
  const [showDeleteEventDialog, setShowDeleteEventDialog] = useState(false)
  const [showDeleteCategoryDialog, setShowDeleteCategoryDialog] =
    useState(false)
  const [eventToDelete, setEventToDelete] = useState<number | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(
    null
  )
  const [showEventDetailDialog, setShowEventDetailDialog] = useState(false)
  const [selectedEventForDetail, setSelectedEventForDetail] =
    useState<Event | null>(null)
  const [eventSpeakers, setEventSpeakers] = useState<string[]>([])
  const [newSpeaker, setNewSpeaker] = useState("")
  const [eventChairpeople, setEventChairpeople] = useState<string[]>([])
  const [newChairperson, setNewChairperson] = useState("")
  const [programVenueRooms, setProgramVenueRooms] = useState<string[]>([])
  const [newVenueRoom, setNewVenueRoom] = useState("")
  const { toast } = useToast()

  const programForm = useForm<z.infer<typeof programSchema>>({
    resolver: zodResolver(programSchema),
    defaultValues: {
      title: "",
      description: "",
      logo: "",
      start_date: "",
      end_date: "",
      location_name: "",
      location_street: "",
      location_suite: "",
      location_city: "",
      location_state: "",
      location_zip: "",
      venue_rooms: [],
      hospitality: "",
      theme: "",
      big_book_passage: "",
      design: "",
      promote: [],
      content: ""
    }
  })

  const eventForm = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      image: "",
      date: "",
      start_time: "",
      end_time: "",
      location: "",
      event_category_id: 0,
      can_save: false,
      asl: false,
      languages: [],
      hybrid: false,
      speakers: [],
      program_id: 0
    }
  })

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      title: "",
      color: "#3b82f6",
      program_id: 0
    }
  })

  const foodForm = useForm<z.infer<typeof foodSchema>>({
    resolver: zodResolver(foodSchema),
    defaultValues: {
      category: "",
      name: "",
      description: "",
      image: "",
      location: "",
      distance: null,
      menu: ""
    }
  })

  const activityForm = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      category: "",
      name: "",
      description: "",
      image: "",
      location: "",
      distance: null
    }
  })

  const hospitalityForm = useForm<z.infer<typeof hospitalitySchema>>({
    resolver: zodResolver(hospitalitySchema),
    defaultValues: {
      location: "",
      times: []
    }
  })

  const designForm = useForm<z.infer<typeof designSchema>>({
    resolver: zodResolver(designSchema),
    defaultValues: {
      colors: {
        primary: "#17406A",
        secondary: "#E6C29A",
        primaryDark: "#2980B9",
        secondaryDark: "#E6C29A",
        info: "#31C3D7",
        success: "#28A745",
        warning: "#FFC107",
        error: "#DC3545"
      }
    }
  })

  const contentForm = useForm<z.infer<typeof contentSchema>>({
    resolver: zodResolver(contentSchema),
    defaultValues: {
      faq: [],
      services: {
        rides: { title: "", description: "", internal_description: "" },
        support: { title: "", description: "", internal_description: "" },
        hospitality: { title: "", description: "", internal_description: "" },
        volunteering: {
          title: "",
          description: "",
          internal_description: "",
          signup_destination: "internal",
          external_signup_url: ""
        },
        accessibility: { title: "", description: "", internal_description: "" }
      }
    }
  })

  // Get unique filter options
  const filterOptions = useMemo(() => {
    // Preserve the order of locations as they appear in the events (sorted by date)
    const locationsSet = new Set<string>()
    const locations: string[] = []
    events.forEach((e) => {
      if (!locationsSet.has(e.location)) {
        locationsSet.add(e.location)
        locations.push(e.location)
      }
    })
    
    const days = Array.from(
      new Set(events.map((e) => getWeekdayFromDateString(e.date)))
    ).sort()
    const times = Array.from(
      new Set(
        events.map((e) => {
          const hour = parseInt(e.start_time.split(":")[0])
          if (hour < 12) return "Morning"
          else if (hour < 17) return "Afternoon"
          else return "Evening"
        })
      )
    ).sort()

    return { locations, days, times }
  }, [events])

  const filteredAndSortedEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      const matchesSearch =
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesCategories =
        filters.categories.length === 0 ||
        filters.categories.includes(event.event_category_id.toString())

      const matchesLocations =
        filters.locations.length === 0 ||
        filters.locations.includes(event.location)

      const eventDay = getWeekdayFromDateString(event.date)
      const matchesDays =
        filters.days.length === 0 || filters.days.includes(eventDay)

      const hour = parseInt(event.start_time.split(":")[0])
      const timeOfDay =
        hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"
      const matchesTimes =
        filters.times.length === 0 || filters.times.includes(timeOfDay)

      return (
        matchesSearch &&
        matchesCategories &&
        matchesLocations &&
        matchesDays &&
        matchesTimes
      )
    })

    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title)
          break
        case "date":
          comparison = compareDates(a.date, b.date)
          break
        case "start_time":
          comparison = a.start_time.localeCompare(b.start_time)
          break
        case "location":
          comparison = a.location.localeCompare(b.location)
          break
        case "category":
          const aCategory = a.event_categories?.title || ""
          const bCategory = b.event_categories?.title || ""
          comparison = aCategory.localeCompare(bCategory)
          break
        default:
          comparison = a.title.localeCompare(b.title)
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    return filtered
  }, [events, searchTerm, sortField, sortOrder, filters])

  // Format location for display
  const formatLocation = (location: ProgramLocation | string | null) => {
    if (!location) return "No location set"

    if (typeof location === "string") return location

    if (typeof location === "object") {
      const { name, address } = location
      if (name && address) {
        const { street, suite, city, state, zip } = address
        const addressParts = [
          street,
          suite && `Suite ${suite}`,
          city && state && `${city}, ${state}`,
          zip
        ].filter(Boolean)

        return `${name} - ${addressParts.join(", ")}`
      }
      if (name) return name
    }

    return JSON.stringify(location)
  }

  // Get gradient colors from program design or use default
  const getGradientColors = () => {
    if (selectedProgram?.design?.colors) {
      const { primary, secondary } = selectedProgram.design.colors
      if (primary && secondary) {
        return {
          style: {
            "--gradient-from": primary,
            "--gradient-to": secondary
          } as React.CSSProperties,
          className:
            "bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)]"
        }
      }
      if (primary) {
        return {
          style: {
            "--gradient-from": primary,
            "--gradient-to": "#475569" // slate-600
          } as React.CSSProperties,
          className:
            "bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-to)]"
        }
      }
    }
    return {
      style: {},
      className: "bg-gradient-to-r from-slate-900 to-slate-600"
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedProgram) {
      loadProgramData(selectedProgram.id)
      // Ensure venue rooms are available for event form
      setProgramVenueRooms(selectedProgram.venue_rooms || [])
    }
  }, [selectedProgram])

  // Populate food form when editing
  useEffect(() => {
    if (foodToEdit) {
      foodForm.reset({
        category: foodToEdit.category,
        name: foodToEdit.name,
        description: foodToEdit.description,
        image: foodToEdit.image || '',
        location: foodToEdit.location,
        distance: foodToEdit.distance,
        menu: foodToEdit.menu || ''
      })
    } else {
      foodForm.reset({
        category: '',
        name: '',
        description: '',
        image: '',
        location: '',
        distance: null,
        menu: ''
      })
    }
  }, [foodForm, foodToEdit])

  // Populate activity form when editing
  useEffect(() => {
    if (activityToEdit) {
      activityForm.reset({
        category: activityToEdit.category,
        name: activityToEdit.name,
        description: activityToEdit.description,
        image: activityToEdit.image || '',
        location: activityToEdit.location,
        distance: activityToEdit.distance
      })
    } else {
      activityForm.reset({
        category: '',
        name: '',
        description: '',
        image: '',
        location: '',
        distance: null
      })
    }
  }, [activityForm, activityToEdit])

  const loadInitialData = async () => {
    setLoading(true)
    const [{ programs }, conferenceState] = await Promise.all([
      getPrograms(),
      getConferenceState()
    ])
    setPrograms(programs)
    setCurrentConferenceStatus(conferenceState.status)
    setCurrentConferenceProgramId(
      conferenceState.current_program_id?.toString() || "none"
    )
    setSavedCurrentProgramId(conferenceState.current_program_id)

    if (programs.length > 0) {
      const currentProgram = programs.find(
        (program) => program.id === conferenceState.current_program_id
      )
      setSelectedProgram(currentProgram || programs[0])
    }

    setLoading(false)
  }

  const handleSaveConferenceState = async () => {
    setSavingConferenceState(true)
    try {
      const currentProgramId =
        currentConferenceStatus === "none"
          ? null
          : Number(currentConferenceProgramId)

      if (currentConferenceStatus !== "none" && !currentProgramId) {
        toast({
          title: "Select a program",
          description: "Planning and active states require a selected program.",
          variant: "destructive"
        })
        return
      }

      const result = await setConferenceState({
        status: currentConferenceStatus,
        currentProgramId
      })

      if (result.error) {
        toast({
          title: "Current conference not updated",
          description: result.error,
          variant: "destructive"
        })
        return
      }

      const nextProgramId = result.state?.current_program_id || null
      setSavedCurrentProgramId(nextProgramId)
      setCurrentConferenceProgramId(nextProgramId?.toString() || "none")

      if (nextProgramId) {
        const currentProgram = programs.find((program) => program.id === nextProgramId)
        if (currentProgram) {
          setSelectedProgram(currentProgram)
        }
      }

      toast({
        title: "Current conference updated",
        description:
          currentConferenceStatus === "active"
            ? "The selected program is now live in the mobile app."
            : currentConferenceStatus === "planning"
              ? "The mobile app will show the planning page for this program."
              : "The mobile app will show the no-conference page."
      })
    } finally {
      setSavingConferenceState(false)
    }
  }

  const loadProgramData = async (programId: number) => {
    const [
      eventsResult,
      categoriesResult,
      venueResult,
      foodResult,
      activitiesResult
    ] = await Promise.all([
      getEvents(programId),
      getEventCategories(programId),
      getVenue(programId),
      getFoodItems(programId),
      getActivities(programId)
    ])

    setEvents(eventsResult.events)
    setCategories(categoriesResult.categories)
    setFoodItems(foodResult.foodItems)
    setActivities(activitiesResult.activities)
    
    // Normalize and set venue data
    if (venueResult.venue) {
      // Normalize the venue data structure if needed
      const normalizedVenue = {
        ...venueResult.venue,
        floors: Array.isArray(venueResult.venue.floors?.[0]) 
          ? venueResult.venue.floors[0] 
          : venueResult.venue.floors || [],
        amenities: Array.isArray(venueResult.venue.amenities?.[0]) 
          ? venueResult.venue.amenities[0] 
          : venueResult.venue.amenities || []
      }
      setVenue(normalizedVenue)
    } else {
      setVenue(null)
      console.log('No venue data found for program:', programId)
    }
  }

  const handleProgramSubmit = async (values: z.infer<typeof programSchema>) => {
    try {
      const locationObject = {
        name: (values.location_name || "").trim(),
        address: {
          street: (values.location_street || "").trim(),
          suite: (values.location_suite || "").trim(),
          city: (values.location_city || "").trim(),
          state: (values.location_state || "").trim(),
          zip: (values.location_zip || "").trim()
        }
      }

      const programData = {
        title: values.title.trim(),
        description: values.description.trim(),
        logo: (values.logo || "").trim(),
        start_date: values.start_date,
        end_date: values.end_date,
        location: locationObject,
        venue_rooms: programVenueRooms,
        hospitality: values.hospitality ? JSON.parse(values.hospitality) : null,
        theme: (values.theme || "").trim(),
        big_book_passage: (values.big_book_passage || "").trim(),
        design: values.design ? JSON.parse(values.design) : null,
        promote: values.promote || [],
        content: values.content ? JSON.parse(values.content) : null
      }

      if (selectedProgram) {
        const { error } = await updateProgram(selectedProgram.id, programData)
        if (error) throw new Error(error)
        toast({ title: "Program updated successfully!" })
      } else {
        const { error } = await createProgram(programData)
        if (error) throw new Error(error)
        toast({ title: "Program created successfully!" })
      }

      setShowProgramDialog(false)
      loadInitialData()
    } catch (error) {
      console.error("Program submission error:", error)
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save program",
        variant: "destructive"
      })
    }
  }

  const handleEventSubmit = async (values: z.infer<typeof eventSchema>) => {
    try {
      const eventData = {
        ...values,
        title: values.title.trim(),
        description: values.description.trim(),
        image: (values.image || "").trim(),
        location: values.location.trim(),
        speakers: eventSpeakers.map(speaker => speaker.trim()),
        chairpeople: eventChairpeople.map(chairperson => chairperson.trim()),
        languages: values.languages.map(lang => lang.trim()),
        program_id: selectedProgram?.id || 0
      }

      if (editingEvent) {
        const { error } = await updateEvent(editingEvent.id, eventData)
        if (error) throw new Error(error)
        toast({ title: "Event updated successfully!" })
      } else {
        const { error } = await createEvent(eventData)
        if (error) throw new Error(error)
        toast({ title: "Event created successfully!" })
      }

      setShowEventDialog(false)
      setEditingEvent(null)
      setEventSpeakers([])
      setEventChairpeople([])
      if (selectedProgram) {
        loadProgramData(selectedProgram.id)
      }
    } catch (error) {
      console.error("Event submission error:", error)
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save event",
        variant: "destructive"
      })
    }
  }

  const handleCategorySubmit = async (
    values: z.infer<typeof categorySchema>
  ) => {
    try {
      const categoryData = {
        ...values,
        title: values.title.trim(),
        color: values.color.trim(),
        program_id: selectedProgram?.id || 0
      }

      if (editingCategory) {
        const { error } = await updateEventCategory(
          editingCategory.id,
          categoryData
        )
        if (error) throw new Error(error)
        toast({ title: "Category updated successfully!" })
      } else {
        const { error } = await createEventCategory(categoryData)
        if (error) throw new Error(error)
        toast({ title: "Category created successfully!" })
      }

      setShowCategoryDialog(false)
      setEditingCategory(null)
      if (selectedProgram) {
        loadProgramData(selectedProgram.id)
      }
    } catch (error) {
      console.error("Category submission error:", error)
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive"
      })
    }
  }

  const handleDeleteEvent = async (eventId: number) => {
    try {
      const { error } = await deleteEvent(eventId)
      if (error) throw new Error(error)
      toast({ title: "Event deleted successfully!" })
      if (selectedProgram) {
        loadProgramData(selectedProgram.id)
      }
    } catch (error) {
      console.error("Delete event error:", error)
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete event",
        variant: "destructive"
      })
    }
  }

  const confirmDeleteEvent = () => {
    if (eventToDelete) {
      handleDeleteEvent(eventToDelete)
      setEventToDelete(null)
      setShowDeleteEventDialog(false)
    }
  }

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      const { error } = await deleteEventCategory(categoryId)
      if (error) throw new Error(error)
      toast({ title: "Category deleted successfully!" })
      if (selectedProgram) {
        loadProgramData(selectedProgram.id)
      }
    } catch (error) {
      console.error("Delete category error:", error)
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete category",
        variant: "destructive"
      })
    }
  }

  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      handleDeleteCategory(categoryToDelete)
      setCategoryToDelete(null)
      setShowDeleteCategoryDialog(false)
    }
  }

  const openEditProgram = () => {
    if (selectedProgram) {
      const location =
        typeof selectedProgram.location === "string"
          ? {}
          : selectedProgram.location || {}
      const address = location.address || {}

      console.log("Opening edit program with:", {
        title: selectedProgram.title,
        start_date: selectedProgram.start_date,
        end_date: selectedProgram.end_date
      })

      const formattedStartDate = formatDateForInput(selectedProgram.start_date)
      const formattedEndDate = formatDateForInput(selectedProgram.end_date)

      console.log("Formatted dates:", { formattedStartDate, formattedEndDate })

      // Set values individually for better control
      programForm.setValue("title", selectedProgram.title)
      programForm.setValue("description", selectedProgram.description)
      programForm.setValue("logo", selectedProgram.logo || "")
      programForm.setValue("start_date", formattedStartDate)
      programForm.setValue("end_date", formattedEndDate)
      programForm.setValue("location_name", location.name || "")
      programForm.setValue("location_street", address.street || "")
      programForm.setValue("location_suite", address.suite || "")
      programForm.setValue("location_city", address.city || "")
      programForm.setValue("location_state", address.state || "")
      programForm.setValue("location_zip", address.zip || "")
      programForm.setValue("venue_rooms", selectedProgram.venue_rooms || [])
      programForm.setValue(
        "hospitality",
        selectedProgram.hospitality
          ? JSON.stringify(selectedProgram.hospitality)
          : ""
      )
      programForm.setValue("theme", selectedProgram.theme || "")
      programForm.setValue(
        "big_book_passage",
        selectedProgram.big_book_passage || ""
      )
      programForm.setValue(
        "design",
        selectedProgram.design ? JSON.stringify(selectedProgram.design) : ""
      )
      programForm.setValue("promote", selectedProgram.promote || [])
      programForm.setValue(
        "content",
        selectedProgram.content ? JSON.stringify(selectedProgram.content) : ""
      )

      // Debug form values after setting
      console.log("Form values after setting:", {
        start_date: programForm.getValues("start_date"),
        end_date: programForm.getValues("end_date"),
        title: programForm.getValues("title")
      })

      setProgramVenueRooms(selectedProgram.venue_rooms || [])
    }
    setShowProgramDialog(true)
  }

  const openHospitalityDialog = () => {
    if (selectedProgram && selectedProgram.hospitality) {
      hospitalityForm.reset({
        location: selectedProgram.hospitality.location || "",
        times: selectedProgram.hospitality.times || []
      })
    }
    setShowHospitalityDialog(true)
  }

  const openDesignDialog = () => {
    if (selectedProgram && selectedProgram.design) {
      const colors = selectedProgram.design.colors || {}
      designForm.reset({
        colors: {
          primary: colors.primary || "#17406A",
          secondary: colors.secondary || "#E6C29A",
          primaryDark: colors.primaryDark || "#2980B9",
          secondaryDark: colors.secondaryDark || "#E6C29A",
          info: colors.info || "#31C3D7",
          success: colors.success || "#28A745",
          warning: colors.warning || "#FFC107",
          error: colors.error || "#DC3545"
        }
      })
    }
    setShowDesignDialog(true)
  }

  const openContentDialog = () => {
    if (selectedProgram && selectedProgram.content) {
      const content = selectedProgram.content
      contentForm.reset({
        faq: content.faq || [],
        services: {
          rides: content.services?.rides || {
            title: "",
            description: "",
            internal_description: ""
          },
          support: content.services?.support || {
            title: "",
            description: "",
            internal_description: ""
          },
          hospitality: content.services?.hospitality || {
            title: "",
            description: "",
            internal_description: ""
          },
          volunteering: {
            title: "",
            description: "",
            internal_description: "",
            signup_destination: "internal",
            external_signup_url: "",
            ...content.services?.volunteering
          },
          accessibility: content.services?.accessibility || {
            title: "",
            description: "",
            internal_description: ""
          }
        }
      })
    }
    setShowContentDialog(true)
  }

  // Group events by day for promoted events dialog
  const groupEventsByDay = (events: Event[]) => {
    const grouped: { [key: string]: Event[] } = {}

    events.forEach((event) => {
      const dayKey = formatDateDisplay(event.date, {
        weekday: "long",
        month: "long",
        day: "numeric"
      })

      if (!grouped[dayKey]) {
        grouped[dayKey] = []
      }
      grouped[dayKey].push(event)
    })

    // Sort events within each day by start time
    Object.keys(grouped).forEach((day) => {
      grouped[day].sort((a, b) => a.start_time.localeCompare(b.start_time))
    })

    return grouped
  }

  // Filter events for promoted events dialog
  const getFilteredEventsForPromotion = () => {
    let filtered = events

    // Apply search filter
    if (promotedEventsSearch) {
      filtered = filtered.filter(
        (event) =>
          event.title
            .toLowerCase()
            .includes(promotedEventsSearch.toLowerCase()) ||
          event.description
            .toLowerCase()
            .includes(promotedEventsSearch.toLowerCase())
      )
    }

    // Apply selected only filter
    if (showSelectedOnly) {
      filtered = filtered.filter((event) =>
        tempPromotedEvents.includes(event.id)
      )
    }

    return groupEventsByDay(filtered)
  }

  const openEditEvent = (event: Event) => {
    setEditingEvent(event)
    setEventSpeakers(event.speakers || [])
    setEventChairpeople(event.chairpeople || [])
    eventForm.reset({
      title: event.title,
      description: event.description,
      image: event.image || "",
      date: event.date,
      start_time: event.start_time,
      end_time: event.end_time,
      location: event.location,
      event_category_id: event.event_category_id,
      can_save: event.can_save,
      asl: event.asl || false,
      languages: event.languages || [],
      hybrid: event.hybrid || false,
      speakers: event.speakers || [],
      chairpeople: event.chairpeople || [],
      program_id: event.program_id
    })
    setShowEventDialog(true)
  }

  const openAddEvent = () => {
    setEditingEvent(null)
    setEventSpeakers([])
    setEventChairpeople([])
    eventForm.reset({
      title: "",
      description: "",
      image: "",
      date: "",
      start_time: "",
      end_time: "",
      location: "",
      event_category_id: 0,
      can_save: false,
      asl: false,
      languages: [],
      hybrid: false,
      speakers: [],
      chairpeople: [],
      program_id: selectedProgram?.id || 0
    })
    setShowEventDialog(true)
  }

  const openEditCategory = (category: EventCategory) => {
    setEditingCategory(category)
    categoryForm.reset({
      title: category.title,
      color: category.color,
      program_id: category.program_id
    })
    setShowCategoryDialog(true)
  }

  const openAddCategory = () => {
    setEditingCategory(null)
    categoryForm.reset({
      title: "",
      color: "#3b82f6",
      program_id: selectedProgram?.id || 0
    })
    setShowCategoryDialog(true)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const addSpeaker = () => {
    if (newSpeaker.trim()) {
      setEventSpeakers([...eventSpeakers, newSpeaker.trim()])
      setNewSpeaker("")
    }
  }

  const removeSpeaker = (index: number) => {
    setEventSpeakers(eventSpeakers.filter((_, i) => i !== index))
  }

  const addChairperson = () => {
    if (newChairperson.trim()) {
      setEventChairpeople([...eventChairpeople, newChairperson.trim()])
      setNewChairperson("")
    }
  }

  const removeChairperson = (index: number) => {
    setEventChairpeople(eventChairpeople.filter((_, i) => i !== index))
  }

  const addVenueRoom = () => {
    if (newVenueRoom.trim()) {
      setProgramVenueRooms([...programVenueRooms, newVenueRoom.trim()])
      setNewVenueRoom("")
    }
  }

  const removeVenueRoom = (index: number) => {
    setProgramVenueRooms(programVenueRooms.filter((_, i) => i !== index))
  }

  const toggleFilter = (filterType: keyof FilterState, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter((v) => v !== value)
        : [...prev[filterType], value]
    }))
  }

  const clearFilters = () => {
    setFilters({
      categories: [],
      locations: [],
      days: [],
      times: []
    })
  }

  const hasActiveFilters = Object.values(filters).some((arr) => arr.length > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading program data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Program Management</h1>
          <p className="text-muted-foreground">
            Manage conference programs and events
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedProgram?.id.toString() || ""}
            onValueChange={(value) => {
              const program = programs.find((p) => p.id.toString() === value)
              setSelectedProgram(program || null)
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((program) => (
                <SelectItem key={program.id} value={program.id.toString()}>
                  {program.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Current Conference</CardTitle>
              <CardDescription>
                Controls what the mobile app loads for attendees.
              </CardDescription>
            </div>
            <Badge
              variant={
                currentConferenceStatus === "active"
                  ? "default"
                  : currentConferenceStatus === "planning"
                    ? "secondary"
                    : "outline"
              }
              className="w-fit capitalize"
            >
              {currentConferenceStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={currentConferenceStatus}
                onValueChange={(value) => {
                  const status = value as ConferenceStatus
                  setCurrentConferenceStatus(status)
                  if (status === "none") {
                    setCurrentConferenceProgramId("none")
                  } else if (
                    currentConferenceProgramId === "none" &&
                    selectedProgram
                  ) {
                    setCurrentConferenceProgramId(selectedProgram.id.toString())
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Current</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={currentConferenceProgramId}
                disabled={currentConferenceStatus === "none"}
                onValueChange={setCurrentConferenceProgramId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select current program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>
                    Select a program
                  </SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id.toString()}>
                      {program.title}
                      {program.id === savedCurrentProgramId ? " (current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Planning shows a branded holding page. Active unlocks the full
                program in the app.
              </p>
            </div>

            <Button
              onClick={handleSaveConferenceState}
              disabled={savingConferenceState}
            >
              {savingConferenceState ? "Saving..." : "Save State"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedProgram && (
        <Card>
          <CardHeader>
            <CardTitle>No Program Selected</CardTitle>
            <CardDescription>
              Select a program from the dropdown above to manage its details and
              events.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {selectedProgram && (
        <Tabs defaultValue="program-view" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="program-view">Overview</TabsTrigger>
            <TabsTrigger value="events-management">Events</TabsTrigger>
            <TabsTrigger value="food-management">Food</TabsTrigger>
            <TabsTrigger value="activities-management">Activities</TabsTrigger>
          </TabsList>

          <TabsContent value="program-view" className="space-y-6">
            <div className="grid gap-6">
              {/* Hero Section */}
              <Card
                className={getGradientColors().className}
                style={getGradientColors().style}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                        <Calendar className="h-8 w-8 text-primary-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl text-white">
                          {selectedProgram.title}
                        </CardTitle>
                        <CardDescription className="text-lg text-white/80">
                          {selectedProgram.theme || "Conference Program"}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={openEditProgram}
                      size="lg"
                      variant="secondary"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Program
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Key Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <CalendarDays className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Duration
                        </p>
                        <p className="font-semibold">
                          {formatDateDisplay(selectedProgram.start_date)} -{" "}
                          {formatDateDisplay(selectedProgram.end_date)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Location
                        </p>
                        <p className="font-semibold">
                          {formatLocation(selectedProgram.location)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Events
                        </p>
                        <p className="font-semibold text-2xl">
                          {events.length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Management Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Promoted Events Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-yellow-600" />
                      Promoted Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {selectedProgram.promote?.length || 0} events promoted
                      </p>
                      <Button
                        onClick={() => {
                          setTempPromotedEvents(selectedProgram?.promote || [])
                          setShowPromotedEventsDialog(true)
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Edit className="mr-2 h-3 w-3" />
                        Manage
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Hospitality Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-purple-600" />
                      Hospitality
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {selectedProgram.hospitality?.times?.length || 0} time
                        slots
                      </p>
                      <Button
                        onClick={openHospitalityDialog}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Edit className="mr-2 h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Design Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Palette className="h-4 w-4 text-blue-600" />
                      Design
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex gap-1 flex-wrap">
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{
                            backgroundColor:
                              selectedProgram.design?.colors?.primary ||
                              "#17406A"
                          }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{
                            backgroundColor:
                              selectedProgram.design?.colors?.secondary ||
                              "#E6C29A"
                          }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{
                            backgroundColor:
                              selectedProgram.design?.colors?.info || "#31C3D7"
                          }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{
                            backgroundColor:
                              selectedProgram.design?.colors?.success ||
                              "#28A745"
                          }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{
                            backgroundColor:
                              selectedProgram.design?.colors?.warning ||
                              "#FFC107"
                          }}
                        />
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{
                            backgroundColor:
                              selectedProgram.design?.colors?.error || "#DC3545"
                          }}
                        />
                      </div>
                      <Button
                        onClick={openDesignDialog}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Edit className="mr-2 h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Content Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Settings className="h-4 w-4 text-green-600" />
                      Content
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {selectedProgram.content?.faq?.length || 0} FAQ items
                      </p>
                      <Button
                        onClick={openContentDialog}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Edit className="mr-2 h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Program Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Description
                      </Label>
                      <p className="text-sm mt-1">
                        {selectedProgram.description}
                      </p>
                    </div>
                    {selectedProgram.big_book_passage && (
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">
                          Big Book Passage
                        </Label>
                        <p className="text-sm mt-1 italic">
                          {selectedProgram.big_book_passage}
                        </p>
                      </div>
                    )}
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">
                        Venue Rooms
                      </Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedProgram.venue_rooms?.map((room, index) => (
                          <Badge key={index} variant="outline">
                            {room}
                          </Badge>
                        )) || <span className="text-sm">No rooms set</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Event Categories
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {categories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: category.color }}
                            ></div>
                            <span className="font-medium">
                              {category.title}
                            </span>
                          </div>
                          <Badge variant="secondary">
                            {
                              events.filter(
                                (e) => e.event_category_id === category.id
                              ).length
                            }{" "}
                            events
                          </Badge>
                        </div>
                      ))}
                      {categories.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No categories created yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Venue Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Venue Information
                    </span>
                    <Button 
                      onClick={() => {
                        // Initialize venue if it doesn't exist
                        if (!venue) {
                          setVenue({
                            id: 0,
                            program_id: selectedProgram.id,
                            floors: [],
                            amenities: []
                          })
                        }
                        setShowVenueDialog(true)
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Venue
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Manage venue floors and amenities
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {venue ? (
                    <>
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Floors</h4>
                        {venue.floors && venue.floors.length > 0 ? (
                          <div className="space-y-2">
                            {venue.floors.map((floor: VenueFloor, index: number) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium">{floor.name}</span>
                                {floor.description && (
                                  <span className="text-muted-foreground ml-2">- {floor.description}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No floors configured</p>
                        )}
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-semibold text-sm mb-2">Amenities</h4>
                        {venue.amenities && venue.amenities.length > 0 ? (
                          <div className="space-y-2">
                            {venue.amenities.map((amenity: VenueAmenity, index: number) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium">{amenity.name}</span>
                                {amenity.description && (
                                  <span className="text-muted-foreground ml-2">- {amenity.description}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No amenities configured</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No venue information configured</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events-management" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Events Management
                    </CardTitle>
                    <CardDescription>
                      Manage events and categories for this program
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={openAddEvent}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Event
                    </Button>
                    <Button onClick={openAddCategory} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Categories Section */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Event Categories
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: category.color }}
                          ></div>
                          <span className="text-sm font-medium">
                            {category.title}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditCategory(category)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCategoryToDelete(category.id)
                              setShowDeleteCategoryDialog(true)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Events Table Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Events ({filteredAndSortedEvents.length})
                    </h3>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search events..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* Category Filter */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Filter className="mr-2 h-4 w-4" />
                            Categories
                            {filters.categories.length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {filters.categories.length}
                              </Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                          <div className="space-y-2">
                            {categories.map((category) => (
                              <div
                                key={category.id}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`category-${category.id}`}
                                  checked={filters.categories.includes(
                                    category.id.toString()
                                  )}
                                  onCheckedChange={() =>
                                    toggleFilter(
                                      "categories",
                                      category.id.toString()
                                    )
                                  }
                                />
                                <label
                                  htmlFor={`category-${category.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                                >
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: category.color }}
                                  />
                                  {category.title}
                                </label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Location Filter */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MapPin className="mr-2 h-4 w-4" />
                            Locations
                            {filters.locations.length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {filters.locations.length}
                              </Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                          <div className="space-y-2">
                            {filterOptions.locations.map((location) => (
                              <div
                                key={location}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`location-${location}`}
                                  checked={filters.locations.includes(location)}
                                  onCheckedChange={() =>
                                    toggleFilter("locations", location)
                                  }
                                />
                                <label
                                  htmlFor={`location-${location}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {location}
                                </label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Day Filter */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <CalendarDays className="mr-2 h-4 w-4" />
                            Days
                            {filters.days.length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {filters.days.length}
                              </Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                          <div className="space-y-2">
                            {filterOptions.days.map((day) => (
                              <div
                                key={day}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`day-${day}`}
                                  checked={filters.days.includes(day)}
                                  onCheckedChange={() =>
                                    toggleFilter("days", day)
                                  }
                                />
                                <label
                                  htmlFor={`day-${day}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {day}
                                </label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Time Filter */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Clock className="mr-2 h-4 w-4" />
                            Times
                            {filters.times.length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {filters.times.length}
                              </Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48">
                          <div className="space-y-2">
                            {filterOptions.times.map((time) => (
                              <div
                                key={time}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={`time-${time}`}
                                  checked={filters.times.includes(time)}
                                  onCheckedChange={() =>
                                    toggleFilter("times", time)
                                  }
                                />
                                <label
                                  htmlFor={`time-${time}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {time}
                                </label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Events Table */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead
                            className="cursor-pointer"
                            onClick={() => handleSort("title")}
                          >
                            <div className="flex items-center gap-2">
                              Title
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer"
                            onClick={() => handleSort("date")}
                          >
                            <div className="flex items-center gap-2">
                              Date
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer"
                            onClick={() => handleSort("start_time")}
                          >
                            <div className="flex items-center gap-2">
                              Time
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer"
                            onClick={() => handleSort("location")}
                          >
                            <div className="flex items-center gap-2">
                              Location
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead
                            className="cursor-pointer"
                            onClick={() => handleSort("category")}
                          >
                            <div className="flex items-center gap-2">
                              Category
                              <ArrowUpDown className="h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead>Accessibility</TableHead>
                          <TableHead>Can Save</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedEvents.map((event) => (
                          <TableRow
                            key={event.id}
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedEventForDetail(event)
                              setShowEventDetailDialog(true)
                            }}
                          >
                            <TableCell className="font-medium">
                              {event.title}
                            </TableCell>
                            <TableCell>
                              {formatDateDisplay(event.date)}
                            </TableCell>
                            <TableCell>
                              {formatTime12Hour(event.start_time)} -{" "}
                              {formatTime12Hour(event.end_time)}
                            </TableCell>
                            <TableCell>{event.location}</TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                style={{
                                  backgroundColor:
                                    event.event_categories?.color,
                                  color: "white"
                                }}
                              >
                                {event.event_categories?.title}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {event.asl && (
                                  <Badge variant="outline" className="text-xs">
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    ASL
                                  </Badge>
                                )}
                                {event.languages?.map((language: string) => (
                                  <Badge key={language} variant="outline" className="text-xs">
                                    <Languages className="h-3 w-3 mr-1" />
                                    {language.charAt(0).toUpperCase() + language.slice(1)}
                                  </Badge>
                                ))}
                                {event.hybrid && (
                                  <Badge variant="outline" className="text-xs">
                                    <Monitor className="h-3 w-3 mr-1" />
                                    Hybrid
                                  </Badge>
                                )}
                                {!event.asl && (!event.languages || event.languages.length === 0) && !event.hybrid && (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  event.can_save ? "default" : "secondary"
                                }
                              >
                                {event.can_save ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openEditEvent(event)
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEventToDelete(event.id)
                                    setShowDeleteEventDialog(true)
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredAndSortedEvents.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-6">
                              {events.length === 0
                                ? "No events found"
                                : "No events match your filters"}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Food Management Tab */}
          <TabsContent value="food-management" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Utensils className="h-5 w-5" />
                    Food Options
                  </span>
                  <Button 
                    onClick={() => {
                      setFoodToEdit(null)
                      setShowFoodDialog(true)
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Food Option
                  </Button>
                </CardTitle>
                <CardDescription>
                  Manage food vendors and dining options
                </CardDescription>
              </CardHeader>
              <CardContent>
                {foodItems.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(
                      foodItems.reduce((acc, item) => {
                        if (!acc[item.category]) acc[item.category] = []
                        acc[item.category].push(item)
                        return acc
                      }, {} as Record<string, Food[]>)
                    ).map(([category, items]) => (
                      <div key={category}>
                        <h3 className="font-semibold mb-3">{category}</h3>
                        <div className="grid gap-3">
                          {items.map((item) => (
                            <Card key={item.id}>
                              <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <CardTitle className="text-base">{item.name}</CardTitle>
                                    <CardDescription>{item.description}</CardDescription>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setFoodToEdit(item)
                                        setShowFoodDialog(true)
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setFoodToDelete(item)
                                        setShowDeleteFoodDialog(true)
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-sm space-y-1">
                                  <p><span className="font-medium">Location:</span> {item.location}</p>
                                  {item.distance && (
                                    <p><span className="font-medium">Distance:</span> {item.distance} miles</p>
                                  )}
                                  {item.menu && (
                                    <p><span className="font-medium">Menu:</span> <a href={item.menu} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Menu</a></p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-4">No food options configured</p>
                    <Button onClick={() => {
                      setFoodToEdit(null)
                      setShowFoodDialog(true)
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Food Option
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activities Management Tab */}
          <TabsContent value="activities-management" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MapPinned className="h-5 w-5" />
                    Activities & Attractions
                  </span>
                  <Button 
                    onClick={() => {
                      setActivityToEdit(null)
                      setShowActivityDialog(true)
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Activity
                  </Button>
                </CardTitle>
                <CardDescription>
                  Manage local activities and attractions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(
                      activities.reduce((acc, item) => {
                        if (!acc[item.category]) acc[item.category] = []
                        acc[item.category].push(item)
                        return acc
                      }, {} as Record<string, Activity[]>)
                    ).map(([category, items]) => (
                      <div key={category}>
                        <h3 className="font-semibold mb-3">{category}</h3>
                        <div className="grid gap-3">
                          {items.map((item) => (
                            <Card key={item.id}>
                              <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <CardTitle className="text-base">{item.name}</CardTitle>
                                    <CardDescription>{item.description}</CardDescription>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setActivityToEdit(item)
                                        setShowActivityDialog(true)
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setActivityToDelete(item)
                                        setShowDeleteActivityDialog(true)
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-sm space-y-1">
                                  <p><span className="font-medium">Location:</span> {item.location}</p>
                                  {item.distance && (
                                    <p><span className="font-medium">Distance:</span> {item.distance} miles</p>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MapPinned className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-4">No activities configured</p>
                    <Button onClick={() => {
                      setActivityToEdit(null)
                      setShowActivityDialog(true)
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Activity
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Program Dialog */}
      <Dialog open={showProgramDialog} onOpenChange={setShowProgramDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProgram ? "Edit Program" : "Create Program"}
            </DialogTitle>
            <DialogDescription>
              {selectedProgram
                ? "Update the program details"
                : "Create a new program"}
            </DialogDescription>
          </DialogHeader>
          <Form {...programForm}>
            <form
              onSubmit={programForm.handleSubmit(handleProgramSubmit)}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={programForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Program title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={programForm.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <FormControl>
                        <Input placeholder="Program theme" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={programForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Program description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={programForm.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={programForm.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Location Details</h3>
                <FormField
                  control={programForm.control}
                  name="location_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Hilton Minneapolis" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={programForm.control}
                    name="location_street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="1001 Marquette Avenue South"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={programForm.control}
                    name="location_suite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suite/Unit</FormLabel>
                        <FormControl>
                          <Input placeholder="Suite 100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={programForm.control}
                    name="location_city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Minneapolis" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={programForm.control}
                    name="location_state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="MN" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={programForm.control}
                    name="location_zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input placeholder="55403" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label>Venue Rooms</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add venue room"
                    value={newVenueRoom}
                    onChange={(e) => setNewVenueRoom(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addVenueRoom()
                      }
                    }}
                  />
                  <Button type="button" onClick={addVenueRoom}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {programVenueRooms.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {programVenueRooms.map((room, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {room}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => removeVenueRoom(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <FormField
                control={programForm.control}
                name="big_book_passage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Big Book Passage</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Big Book passage" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowProgramDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedProgram ? "Update" : "Create"} Program
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Edit Event" : "Create Event"}
            </DialogTitle>
            <DialogDescription>
              {editingEvent ? "Update the event details" : "Create a new event"}
            </DialogDescription>
          </DialogHeader>
          <Form {...eventForm}>
            <form
              onSubmit={eventForm.handleSubmit(handleEventSubmit)}
              className="space-y-4"
            >
              <FormField
                control={eventForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Event title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={eventForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Event description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={eventForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={eventForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a venue room" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {programVenueRooms.map((room) => (
                            <SelectItem key={room} value={room}>
                              {room}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="event_category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem
                              key={category.id}
                              value={category.id.toString()}
                            >
                              {category.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={eventForm.control}
                name="can_save"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Can Save Event</FormLabel>
                      <FormDescription>
                        Allow users to save this event to their personal
                        schedule
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {/* Accessibility Options */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Accessibility Options</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={eventForm.control}
                    name="asl"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4" />
                            ASL Interpretation
                          </FormLabel>
                          <FormDescription>
                            American Sign Language interpreter available
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Languages className="h-4 w-4" />
                      Language Interpretation
                    </Label>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={eventForm.control}
                        name="languages"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value.includes('spanish')}
                                onCheckedChange={(checked) => {
                                  const updatedLanguages = checked
                                    ? [...field.value, 'spanish']
                                    : field.value.filter((lang: string) => lang !== 'spanish')
                                  field.onChange(updatedLanguages)
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">
                              Spanish
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={eventForm.control}
                        name="languages"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value.includes('somali')}
                                onCheckedChange={(checked) => {
                                  const updatedLanguages = checked
                                    ? [...field.value, 'somali']
                                    : field.value.filter((lang: string) => lang !== 'somali')
                                  field.onChange(updatedLanguages)
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">
                              Somali
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={eventForm.control}
                        name="languages"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value.includes('hmong')}
                                onCheckedChange={(checked) => {
                                  const updatedLanguages = checked
                                    ? [...field.value, 'hmong']
                                    : field.value.filter((lang: string) => lang !== 'hmong')
                                  field.onChange(updatedLanguages)
                                }}
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal">
                              Hmong
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <FormField
                    control={eventForm.control}
                    name="hybrid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-2">
                            <Monitor className="h-4 w-4" />
                            Hybrid Meeting
                          </FormLabel>
                          <FormDescription>
                            Available both in-person and online
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label>Speakers</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add speaker name"
                    value={newSpeaker}
                    onChange={(e) => setNewSpeaker(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addSpeaker()
                      }
                    }}
                  />
                  <Button type="button" onClick={addSpeaker}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {eventSpeakers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {eventSpeakers.map((speaker, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {speaker}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => removeSpeaker(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label>Chairpeople</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add chairperson name"
                    value={newChairperson}
                    onChange={(e) => setNewChairperson(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addChairperson()
                      }
                    }}
                  />
                  <Button type="button" onClick={addChairperson}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {eventChairpeople.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {eventChairpeople.map((chairperson, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {chairperson}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1"
                          onClick={() => removeChairperson(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEventDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingEvent ? "Update" : "Create"} Event
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Create Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the category details"
                : "Create a new event category"}
            </DialogDescription>
          </DialogHeader>
          <Form {...categoryForm}>
            <form
              onSubmit={categoryForm.handleSubmit(handleCategorySubmit)}
              className="space-y-4"
            >
              <FormField
                control={categoryForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Category title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input type="color" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCategoryDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingCategory ? "Update" : "Create"} Category
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog */}
      <Dialog
        open={showEventDetailDialog}
        onOpenChange={setShowEventDetailDialog}
      >
        <DialogContent className="max-w-2xl">
          {selectedEventForDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {selectedEventForDetail.title}
                </DialogTitle>
                <DialogDescription>Event Details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert">
                  <p>{selectedEventForDetail.description}</p>
                </div>

                <Separator />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Date</p>
                      <p className="text-muted-foreground">
                        {formatDateDisplay(selectedEventForDetail.date, {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Time</p>
                      <p className="text-muted-foreground">
                        {formatTime12Hour(selectedEventForDetail.start_time)} -{" "}
                        {formatTime12Hour(selectedEventForDetail.end_time)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Location</p>
                      <p className="text-muted-foreground">
                        {selectedEventForDetail.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Palette className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Category</p>
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor:
                            selectedEventForDetail.event_categories?.color,
                          color: "white"
                        }}
                      >
                        {selectedEventForDetail.event_categories?.title}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 sm:col-span-2">
                    <Users className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Speakers</p>
                      {selectedEventForDetail.speakers &&
                      selectedEventForDetail.speakers.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedEventForDetail.speakers.map(
                            (speaker, index) => (
                              <Badge key={index} variant="outline">
                                {speaker}
                              </Badge>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          No speakers listed
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 sm:col-span-2">
                    <Settings className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Chairpeople</p>
                      {selectedEventForDetail.chairpeople &&
                      selectedEventForDetail.chairpeople.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedEventForDetail.chairpeople.map(
                            (chairperson, index) => (
                              <Badge key={index} variant="outline">
                                {chairperson}
                              </Badge>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          No chairpeople listed
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="can_save_detail"
                      checked={selectedEventForDetail.can_save}
                      disabled
                      className="mt-1"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="can_save_detail"
                        className="font-semibold"
                      >
                        Can be saved to personal schedule
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Promoted Events Dialog */}
      <Dialog
        open={showPromotedEventsDialog}
        onOpenChange={setShowPromotedEventsDialog}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Promoted Events</DialogTitle>
            <DialogDescription>
              Select which events should be promoted in the app
            </DialogDescription>
          </DialogHeader>

          {/* Search and Filter Controls */}
          <div className="flex gap-4 p-4 border-b">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={promotedEventsSearch}
                  onChange={(e) => setPromotedEventsSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-selected-only"
                checked={showSelectedOnly}
                onCheckedChange={(checked) =>
                  setShowSelectedOnly(checked === true)
                }
              />
              <Label htmlFor="show-selected-only">Show selected only</Label>
            </div>
          </div>

          {/* Scrollable Events List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              {Object.entries(getFilteredEventsForPromotion()).map(
                ([day, dayEvents]) => (
                  <div key={day} className="space-y-3">
                    <h3 className="font-semibold text-lg text-primary border-b pb-2">
                      {day}
                    </h3>
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{event.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatTime12Hour(event.start_time)} -{" "}
                              {formatTime12Hour(event.end_time)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {event.location}
                            </p>
                          </div>
                          <Checkbox
                            checked={tempPromotedEvents.includes(event.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setTempPromotedEvents([
                                  ...tempPromotedEvents,
                                  event.id
                                ])
                              } else {
                                setTempPromotedEvents(
                                  tempPromotedEvents.filter(
                                    (id) => id !== event.id
                                  )
                                )
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {Object.keys(getFilteredEventsForPromotion()).length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No events found matching your criteria
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 p-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowPromotedEventsDialog(false)
                setTempPromotedEvents([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (selectedProgram) {
                  await updateProgram(selectedProgram.id, {
                    ...selectedProgram,
                    promote: tempPromotedEvents
                  })
                  setShowPromotedEventsDialog(false)
                  setTempPromotedEvents([])
                  toast({
                    title: "Success",
                    description: "Promoted events updated successfully"
                  })
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hospitality Dialog */}
      <Dialog
        open={showHospitalityDialog}
        onOpenChange={setShowHospitalityDialog}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Hospitality Information</DialogTitle>
            <DialogDescription>
              Configure hospitality suite times and location
            </DialogDescription>
          </DialogHeader>
          <Form {...hospitalityForm}>
            <form
              onSubmit={hospitalityForm.handleSubmit(async (values) => {
                if (selectedProgram) {
                  const trimmedValues = {
                    location: values.location.trim(),
                    times: values.times.map(time => ({
                      ...time,
                      day: time.day.trim()
                    }))
                  }
                  await updateProgram(selectedProgram.id, {
                    ...selectedProgram,
                    hospitality: trimmedValues
                  })
                  setShowHospitalityDialog(false)
                  toast({
                    title: "Success",
                    description: "Hospitality information updated successfully"
                  })
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={hospitalityForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Concierge Lounge (7th floor)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Time Slots</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentTimes = hospitalityForm.getValues("times")
                      hospitalityForm.setValue("times", [
                        ...currentTimes,
                        {
                          day: "Friday",
                          start_time: "12:00pm",
                          end_time: "1:00pm"
                        }
                      ])
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Time Slot
                  </Button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {hospitalityForm.watch("times").map((time, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-4 gap-3 p-3 border rounded-lg"
                    >
                      <FormField
                        control={hospitalityForm.control}
                        name={`times.${index}.day`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Day</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Thursday">Thursday</SelectItem>
                                <SelectItem value="Friday">Friday</SelectItem>
                                <SelectItem value="Saturday">
                                  Saturday
                                </SelectItem>
                                <SelectItem value="Sunday">Sunday</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={hospitalityForm.control}
                        name={`times.${index}.start_time`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 5:00pm" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={hospitalityForm.control}
                        name={`times.${index}.end_time`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 7:00pm" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const currentTimes =
                              hospitalityForm.getValues("times")
                            hospitalityForm.setValue(
                              "times",
                              currentTimes.filter((_, i) => i !== index)
                            )
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowHospitalityDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Hospitality</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Design Dialog */}
      <Dialog open={showDesignDialog} onOpenChange={setShowDesignDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Design Colors</DialogTitle>
            <DialogDescription>
              Configure the color scheme for your program
            </DialogDescription>
          </DialogHeader>
          <Form {...designForm}>
            <form
              onSubmit={designForm.handleSubmit(async (values) => {
                if (selectedProgram) {
                  const trimmedValues = {
                    colors: {
                      primary: values.colors.primary.trim(),
                      secondary: values.colors.secondary.trim(),
                      primaryDark: values.colors.primaryDark ? values.colors.primaryDark.trim() : values.colors.primaryDark,
                      secondaryDark: values.colors.secondaryDark ? values.colors.secondaryDark.trim() : values.colors.secondaryDark,
                      info: values.colors.info ? values.colors.info.trim() : values.colors.info,
                      success: values.colors.success ? values.colors.success.trim() : values.colors.success,
                      warning: values.colors.warning ? values.colors.warning.trim() : values.colors.warning,
                      error: values.colors.error ? values.colors.error.trim() : values.colors.error
                    }
                  }
                  await updateProgram(selectedProgram.id, {
                    ...selectedProgram,
                    design: trimmedValues
                  })
                  setShowDesignDialog(false)
                  toast({
                    title: "Success",
                    description: "Design colors updated successfully"
                  })
                }
              })}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={designForm.control}
                  name="colors.primary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-16" {...field} />
                          <Input placeholder="#17406A" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={designForm.control}
                  name="colors.secondary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-16" {...field} />
                          <Input placeholder="#E6C29A" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={designForm.control}
                  name="colors.primaryDark"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Dark Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-16" {...field} />
                          <Input placeholder="#2980B9" {...field} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={designForm.control}
                  name="colors.secondaryDark"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Dark Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-16" {...field} />
                          <Input placeholder="#E6C29A" {...field} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={designForm.control}
                  name="colors.info"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Info Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-16" {...field} />
                          <Input placeholder="#31C3D7" {...field} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={designForm.control}
                  name="colors.success"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Success Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-16" {...field} />
                          <Input placeholder="#28A745" {...field} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={designForm.control}
                  name="colors.warning"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warning Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-16" {...field} />
                          <Input placeholder="#FFC107" {...field} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={designForm.control}
                  name="colors.error"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Error Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-16" {...field} />
                          <Input placeholder="#DC3545" {...field} />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDesignDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Design</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Content Dialog */}
      <Dialog open={showContentDialog} onOpenChange={setShowContentDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
            <DialogDescription>
              Configure FAQ and service information
            </DialogDescription>
          </DialogHeader>
          <Form {...contentForm}>
            <form
              onSubmit={contentForm.handleSubmit(async (values) => {
                if (selectedProgram) {
                  const trimmedValues = {
                    faq: values.faq.map(item => ({
                      question: item.question.trim(),
                      answer: item.answer.trim()
                    })),
                    services: {
                      rides: values.services.rides ? {
                        title: values.services.rides.title.trim(),
                        description: values.services.rides.description.trim(),
                        internal_description: values.services.rides.internal_description ? values.services.rides.internal_description.trim() : values.services.rides.internal_description
                      } : values.services.rides,
                      support: values.services.support ? {
                        title: values.services.support.title.trim(),
                        description: values.services.support.description.trim(),
                        internal_description: values.services.support.internal_description ? values.services.support.internal_description.trim() : values.services.support.internal_description
                      } : values.services.support,
                      hospitality: values.services.hospitality ? {
                        title: values.services.hospitality.title.trim(),
                        description: values.services.hospitality.description.trim(),
                        internal_description: values.services.hospitality.internal_description ? values.services.hospitality.internal_description.trim() : values.services.hospitality.internal_description
                      } : values.services.hospitality,
                      volunteering: values.services.volunteering ? {
                        title: values.services.volunteering.title.trim(),
                        description: values.services.volunteering.description.trim(),
                        internal_description: values.services.volunteering.internal_description ? values.services.volunteering.internal_description.trim() : values.services.volunteering.internal_description,
                        signup_destination: values.services.volunteering.signup_destination,
                        external_signup_url: values.services.volunteering.signup_destination === "external" && values.services.volunteering.external_signup_url
                          ? values.services.volunteering.external_signup_url.trim()
                          : ""
                      } : values.services.volunteering,
                      accessibility: values.services.accessibility ? {
                        title: values.services.accessibility.title.trim(),
                        description: values.services.accessibility.description.trim(),
                        internal_description: values.services.accessibility.internal_description ? values.services.accessibility.internal_description.trim() : values.services.accessibility.internal_description
                      } : values.services.accessibility
                    }
                  }
                  await updateProgram(selectedProgram.id, {
                    ...selectedProgram,
                    content: trimmedValues
                  })
                  setShowContentDialog(false)
                  toast({
                    title: "Success",
                    description: "Content updated successfully"
                  })
                }
              })}
              className="space-y-6"
            >
              {/* FAQ Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">FAQ</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentFaq = contentForm.getValues("faq")
                      contentForm.setValue("faq", [
                        ...currentFaq,
                        { question: "", answer: "" }
                      ])
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add FAQ
                  </Button>
                </div>

                <Accordion type="multiple" className="w-full">
                  {contentForm.watch("faq").map((faq, index) => (
                    <AccordionItem key={index} value={`faq-${index}`}>
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center justify-between w-full mr-4">
                          <span>
                            FAQ Item {index + 1}
                            {faq.question && (
                              <span className="text-sm text-muted-foreground ml-2">
                                -{" "}
                                {faq.question.length > 50
                                  ? faq.question.substring(0, 50) + "..."
                                  : faq.question}
                              </span>
                            )}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              const currentFaq = contentForm.getValues("faq")
                              contentForm.setValue(
                                "faq",
                                currentFaq.filter((_, i) => i !== index)
                              )
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-4">
                          <FormField
                            control={contentForm.control}
                            name={`faq.${index}.question`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Question</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter question"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contentForm.control}
                            name={`faq.${index}.answer`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Answer</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Enter answer"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {/* Services Section */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold">Services</Label>

                {/* Rides Service */}
                <div className="p-4 border rounded-lg space-y-3">
                  <Label>Rides</Label>
                  <FormField
                    control={contentForm.control}
                    name="services.rides.title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Service title" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.rides.description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Service description"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.rides.internal_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Internal description (optional)"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Support Service */}
                <div className="p-4 border rounded-lg space-y-3">
                  <Label>Support</Label>
                  <FormField
                    control={contentForm.control}
                    name="services.support.title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Service title" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.support.description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Service description"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Hospitality Service */}
                <div className="p-4 border rounded-lg space-y-3">
                  <Label>Hospitality</Label>
                  <FormField
                    control={contentForm.control}
                    name="services.hospitality.title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Service title" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.hospitality.description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Service description"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.hospitality.internal_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Internal description (optional)"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Volunteering Service */}
                <div className="p-4 border rounded-lg space-y-3">
                  <Label>Volunteering</Label>
                  <FormField
                    control={contentForm.control}
                    name="services.volunteering.title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Service title" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.volunteering.description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Service description"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.volunteering.internal_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Internal description (optional)"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.volunteering.signup_destination"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Signup Destination</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose where attendees sign up" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="internal">
                              Internal volunteer form
                            </SelectItem>
                            <SelectItem value="external">
                              SignUpGenius link
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The mobile volunteer card will open this destination.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {contentForm.watch(
                    "services.volunteering.signup_destination"
                  ) === "external" ? (
                    <FormField
                      control={contentForm.control}
                      name="services.volunteering.external_signup_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SignUpGenius URL</FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              inputMode="url"
                              placeholder="https://www.signupgenius.com/go/..."
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Secure signupgenius.com and sugeni.us links are
                            accepted. If the signup collects payments or
                            donations, review the app-store payment rules before
                            publishing it.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                </div>

                {/* Accessibility Service */}
                <div className="p-4 border rounded-lg space-y-3">
                  <Label>Accessibility</Label>
                  <FormField
                    control={contentForm.control}
                    name="services.accessibility.title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Service title" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.accessibility.description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Service description"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={contentForm.control}
                    name="services.accessibility.internal_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Internal description (optional)"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowContentDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Content</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Event Confirmation Dialog */}
      <AlertDialog
        open={showDeleteEventDialog}
        onOpenChange={setShowDeleteEventDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setEventToDelete(null)
                setShowDeleteEventDialog(false)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEvent}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category Confirmation Dialog */}
      <AlertDialog
        open={showDeleteCategoryDialog}
        onOpenChange={setShowDeleteCategoryDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setCategoryToDelete(null)
                setShowDeleteCategoryDialog(false)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCategory}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Venue Dialog */}
      <Dialog open={showVenueDialog} onOpenChange={setShowVenueDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Venue Information</DialogTitle>
            <DialogDescription>
              Configure venue floors and amenities for the conference
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Floors Section */}
            <div>
              <Label className="text-base font-semibold">Floors</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Add floor maps and descriptions for the venue
              </p>
              <div className="space-y-3">
                {(venue?.floors || []).map((floor: VenueFloor, index: number) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid gap-3">
                        <Input
                          placeholder="Floor name (e.g., Main Floor)"
                          value={floor.name || ''}
                          onChange={(e) => {
                            const newFloors = [...(venue?.floors || [])]
                            newFloors[index] = { ...floor, name: e.target.value }
                            if (venue) setVenue({ ...venue, floors: newFloors })
                          }}
                        />
                        <Textarea
                          placeholder="Description"
                          value={floor.description || ''}
                          onChange={(e) => {
                            const newFloors = [...(venue?.floors || [])]
                            newFloors[index] = { ...floor, description: e.target.value }
                            if (venue) setVenue({ ...venue, floors: newFloors })
                          }}
                        />
                        <Input
                          placeholder="Image URL"
                          value={floor.url || ''}
                          onChange={(e) => {
                            const newFloors = [...(venue?.floors || [])]
                            newFloors[index] = { ...floor, url: e.target.value }
                            if (venue) setVenue({ ...venue, floors: newFloors })
                          }}
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (venue) {
                              const newFloors = [...(venue.floors || [])]
                              newFloors.splice(index, 1)
                              setVenue({ ...venue, floors: newFloors })
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Floor
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newFloor = { name: '', description: '', url: '' }
                    if (venue) {
                      setVenue({
                        ...venue,
                        floors: [...(venue.floors || []), newFloor]
                      })
                    } else {
                      setVenue({
                        id: 0,
                        program_id: selectedProgram!.id,
                        floors: [newFloor],
                        amenities: []
                      })
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Floor
                </Button>
              </div>
            </div>

            <Separator />

            {/* Amenities Section */}
            <div>
              <Label className="text-base font-semibold">Amenities</Label>
              <p className="text-sm text-muted-foreground mb-3">
                List venue amenities and accessibility features
              </p>
              <div className="space-y-3">
                {(venue?.amenities || []).map((amenity: VenueAmenity, index: number) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid gap-3">
                        <Input
                          placeholder="Amenity name (e.g., Accessibility)"
                          value={amenity.name || ''}
                          onChange={(e) => {
                            const newAmenities = [...(venue?.amenities || [])]
                            newAmenities[index] = { ...amenity, name: e.target.value }
                            if (venue) setVenue({ ...venue, amenities: newAmenities })
                          }}
                        />
                        <Textarea
                          placeholder="Description"
                          value={amenity.description || ''}
                          onChange={(e) => {
                            const newAmenities = [...(venue?.amenities || [])]
                            newAmenities[index] = { ...amenity, description: e.target.value }
                            if (venue) setVenue({ ...venue, amenities: newAmenities })
                          }}
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (venue) {
                              const newAmenities = [...(venue.amenities || [])]
                              newAmenities.splice(index, 1)
                              setVenue({ ...venue, amenities: newAmenities })
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Amenity
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newAmenity = { name: '', description: '' }
                    if (venue) {
                      setVenue({
                        ...venue,
                        amenities: [...(venue.amenities || []), newAmenity]
                      })
                    } else {
                      setVenue({
                        id: 0,
                        program_id: selectedProgram!.id,
                        floors: [],
                        amenities: [newAmenity]
                      })
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Amenity
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowVenueDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={async () => {
                  if (selectedProgram) {
                    const venueData = venue || {
                      id: 0,
                      program_id: selectedProgram.id,
                      floors: [],
                      amenities: []
                    }
                    
                    const result = await updateVenue(selectedProgram.id, {
                      floors: venueData.floors || [],
                      amenities: venueData.amenities || []
                    })
                    
                    if (result.error) {
                      toast({
                        title: "Error",
                        description: result.error,
                        variant: "destructive"
                      })
                    } else {
                      toast({
                        title: "Success",
                        description: "Venue information updated successfully"
                      })
                      setShowVenueDialog(false)
                      loadProgramData(selectedProgram.id)
                    }
                  }
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Food Dialog */}
      <Dialog open={showFoodDialog} onOpenChange={setShowFoodDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {foodToEdit ? "Edit Food Option" : "Add Food Option"}
            </DialogTitle>
            <DialogDescription>
              Add or edit food vendor information
            </DialogDescription>
          </DialogHeader>
          <Form {...foodForm}>
            <form
              onSubmit={foodForm.handleSubmit(async (values) => {
                if (!selectedProgram) return
                
                try {
                  const trimmedValues = {
                    category: values.category.trim(),
                    name: values.name.trim(),
                    description: values.description.trim(),
                    location: values.location.trim(),
                    image: values.image ? values.image.trim() : values.image,
                    menu: values.menu ? values.menu.trim() : values.menu,
                    distance: values.distance
                  }
                  
                  if (foodToEdit) {
                    await updateFoodItem(foodToEdit.id, trimmedValues)
                    toast({ title: "Food option updated successfully!" })
                  } else {
                    await createFoodItem({
                      ...trimmedValues,
                      program_id: selectedProgram.id,
                      distance: values.distance || null,
                      menu: trimmedValues.menu || null,
                      image: trimmedValues.image || null
                    })
                    toast({ title: "Food option added successfully!" })
                  }
                  setShowFoodDialog(false)
                  setFoodToEdit(null)
                  foodForm.reset()
                  loadProgramData(selectedProgram.id)
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to save food option",
                    variant: "destructive"
                  })
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={foodForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Restaurant, Cafe, Food Truck" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={foodForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Restaurant name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={foodForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description of the food option" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={foodForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Address or location description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={foodForm.control}
                  name="distance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distance (miles)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          placeholder="Distance from venue" 
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={foodForm.control}
                  name="menu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Menu URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://..." 
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowFoodDialog(false)
                    setFoodToEdit(null)
                    foodForm.reset()
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {foodToEdit ? "Update" : "Add"} Food Option
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {activityToEdit ? "Edit Activity" : "Add Activity"}
            </DialogTitle>
            <DialogDescription>
              Add or edit activity information
            </DialogDescription>
          </DialogHeader>
          <Form {...activityForm}>
            <form
              onSubmit={activityForm.handleSubmit(async (values) => {
                if (!selectedProgram) return
                
                try {
                  const trimmedValues = {
                    category: values.category.trim(),
                    name: values.name.trim(),
                    description: values.description.trim(),
                    location: values.location.trim(),
                    image: values.image ? values.image.trim() : values.image,
                    distance: values.distance
                  }
                  
                  if (activityToEdit) {
                    await updateActivity(activityToEdit.id, trimmedValues)
                    toast({ title: "Activity updated successfully!" })
                  } else {
                    await createActivity({
                      ...trimmedValues,
                      program_id: selectedProgram.id,
                      distance: values.distance || null,
                      image: trimmedValues.image || null
                    })
                    toast({ title: "Activity added successfully!" })
                  }
                  setShowActivityDialog(false)
                  setActivityToEdit(null)
                  activityForm.reset()
                  loadProgramData(selectedProgram.id)
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to save activity",
                    variant: "destructive"
                  })
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={activityForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Museum, Park, Entertainment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={activityForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Activity name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={activityForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description of the activity" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={activityForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Address or location description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={activityForm.control}
                name="distance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distance (miles)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1"
                        placeholder="Distance from venue" 
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowActivityDialog(false)
                    setActivityToEdit(null)
                    activityForm.reset()
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {activityToEdit ? "Update" : "Add"} Activity
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Food Confirmation */}
      <AlertDialog open={showDeleteFoodDialog} onOpenChange={setShowDeleteFoodDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Food Option</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{foodToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFoodToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (foodToDelete && selectedProgram) {
                  await deleteFoodItem(foodToDelete.id)
                  toast({ title: "Food option deleted successfully!" })
                  setShowDeleteFoodDialog(false)
                  setFoodToDelete(null)
                  loadProgramData(selectedProgram.id)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Activity Confirmation */}
      <AlertDialog open={showDeleteActivityDialog} onOpenChange={setShowDeleteActivityDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{activityToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActivityToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (activityToDelete && selectedProgram) {
                  await deleteActivity(activityToDelete.id)
                  toast({ title: "Activity deleted successfully!" })
                  setShowDeleteActivityDialog(false)
                  setActivityToDelete(null)
                  loadProgramData(selectedProgram.id)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
