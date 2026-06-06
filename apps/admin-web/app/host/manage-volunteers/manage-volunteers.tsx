"use client"

import {
  createVolunteeringData,
  getEvent,
  getVolunteeringData,
  updateVolunteeringData
} from "@/app/host/manage-volunteers/actions"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { zodResolver } from "@hookform/resolvers/zod"
import { Clock, Edit, Loader2, Plus, Trash2, UserMinus } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

// Types
type Volunteer = {
  id: number
  name: string
  last_initial: string
  phone: string
  email: string
}

type TimeSlot = {
  time: string
  max_volunteers: number
  current_volunteers: Volunteer[]
}

type Job = {
  name: string
  description?: string
  time_slots: TimeSlot[]
}

// Form Schemas
const jobFormSchema = z.object({
  jobName: z
    .string()
    .min(2, { message: "Job name must be at least 2 characters" }),
  description: z.string().optional()
})

const timeSlotFormSchema = z.object({
  startTime: z.string().min(1, { message: "Start time is required" }),
  endTime: z.string().min(1, { message: "End time is required" }),
  maxVolunteers: z.coerce
    .number()
    .min(1, { message: "Maximum volunteers must be at least 1" })
})

export default function ManageVolunteers({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<any>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false)
  const [isTimeSlotDialogOpen, setIsTimeSlotDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editJobName, setEditJobName] = useState("")
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(
    null
  )
  const [deleteJobName, setDeleteJobName] = useState<string | null>(null)
  const [isDeleteJobDialogOpen, setIsDeleteJobDialogOpen] = useState(false)
  const [deleteTimeSlotInfo, setDeleteTimeSlotInfo] = useState<{
    jobName: string
    timeSlot: string
  } | null>(null)
  const [isDeleteTimeSlotDialogOpen, setIsDeleteTimeSlotDialogOpen] =
    useState(false)
  const [isTimeSlotGeneratorOpen, setIsTimeSlotGeneratorOpen] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [generatorStartTime, setGeneratorStartTime] = useState("")
  const [generatorEndTime, setGeneratorEndTime] = useState("")
  const [generatorIncrement, setGeneratorIncrement] = useState("60")
  const [deleteVolunteerInfo, setDeleteVolunteerInfo] = useState<{
    jobName: string
    timeSlot: string
    volunteerId: number
    volunteerName: string
  } | null>(null)
  const [isDeleteVolunteerDialogOpen, setIsDeleteVolunteerDialogOpen] =
    useState(false)

  // Forms
  const jobForm = useForm<z.infer<typeof jobFormSchema>>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      jobName: "",
      description: ""
    }
  })

  const timeSlotForm = useForm<z.infer<typeof timeSlotFormSchema>>({
    resolver: zodResolver(timeSlotFormSchema),
    defaultValues: {
      startTime: "",
      endTime: "",
      maxVolunteers: 1
    }
  })

  // Register custom onChange handlers for time fields
  useEffect(() => {
    // Watch for changes in time fields and round them
    const startTimeSubscription = timeSlotForm.watch((value, { name }) => {
      if (name === "startTime" && value.startTime) {
        const rounded = enforceTimeIncrement(value.startTime as string)
        if (rounded !== value.startTime) {
          timeSlotForm.setValue("startTime", rounded)
        }
      }
      if (name === "endTime" && value.endTime) {
        const rounded = enforceTimeIncrement(value.endTime as string)
        if (rounded !== value.endTime) {
          timeSlotForm.setValue("endTime", rounded)
        }
      }
    })

    return () => startTimeSubscription.unsubscribe()
  }, [timeSlotForm])

  // Fetch event and volunteering data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const eventData = await getEvent(eventId)
        setEvent(eventData)

        // Set default generator start time based on event time
        if (eventData && eventData.time) {
          try {
            // Try to extract event time from eventData, defaulting to 9:00 AM if not specified
            let eventTime = "09:00" // Default time

            if (eventData.time) {
              // If there's a time in the event, use it
              eventTime = eventData.time
            }

            // Calculate a reasonable end time (4 hours after start time)
            const endTimeObj = new Date(`2000-01-01T${eventTime}`)
            endTimeObj.setHours(endTimeObj.getHours() + 4)

            const eventEndTime = `${endTimeObj.getHours().toString().padStart(2, "0")}:${endTimeObj.getMinutes().toString().padStart(2, "0")}`

            // Apply the time increments
            setGeneratorStartTime(enforceTimeIncrement(eventTime))
            setGeneratorEndTime(enforceTimeIncrement(eventEndTime))
          } catch (error) {
            console.error("Error setting default times:", error)
            // Fallback to default times
            setGeneratorStartTime("09:00")
            setGeneratorEndTime("13:00")
          }
        }

        try {
          const volunteeringData = await getVolunteeringData(eventId)
          if (volunteeringData && volunteeringData.jobs) {
            setJobs(volunteeringData.jobs)
          } else {
            // Handle case where jobs array might be empty
            setJobs([])
          }
        } catch (error) {
          console.log("No volunteering data found, creating default structure")
          // Create new volunteering data if it doesn't exist
          const newVolunteeringData = await createVolunteeringData(eventId)
          if (newVolunteeringData && newVolunteeringData.jobs) {
            setJobs(newVolunteeringData.jobs)
          } else {
            setJobs([])
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
        toast.error("Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [eventId])

  // Format time from 24h to 12h format
  const formatTimeFor12Hour = (time: string) => {
    if (!time) return ""
    const [hours, minutes] = time.split(":").map(Number)
    const period = hours >= 12 ? "pm" : "am"
    const hours12 = hours % 12 || 12 // Convert 0 to 12 for 12 AM
    return `${hours12}:${minutes.toString().padStart(2, "0")}${period}`
  }

  // Parse 12-hour time format to 24-hour for input fields
  const parseTimeFor24Hour = (time12h: string) => {
    if (!time12h) return ""

    // Handle formats like "7:30pm" or "7:30 pm"
    const timePart = time12h.replace(/\s+/g, "")
    let hours, minutes, period

    if (timePart.includes(":")) {
      const match = timePart.match(/(\d+):(\d+)([ap]m)/i)
      if (!match) return ""

      hours = parseInt(match[1], 10)
      minutes = parseInt(match[2], 10)
      period = match[3].toLowerCase()
    } else {
      // If format is like "7pm" without minutes
      const match = timePart.match(/(\d+)([ap]m)/i)
      if (!match) return ""

      hours = parseInt(match[1], 10)
      minutes = 0
      period = match[2].toLowerCase()
    }

    // Convert to 24-hour format
    if (period === "pm" && hours < 12) {
      hours += 12
    } else if (period === "am" && hours === 12) {
      hours = 0
    }

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
  }

  // Add a function to enforce 30-minute increments for time inputs
  const enforceTimeIncrement = (time: string) => {
    if (!time) return time

    const [hours, minutes] = time.split(":").map(Number)
    // Round to nearest 30 minutes
    const roundedMinutes = Math.round(minutes / 30) * 30

    return `${hours.toString().padStart(2, "0")}:${roundedMinutes === 60 ? "00" : roundedMinutes.toString().padStart(2, "0")}`
  }

  // Modify the time form fields to use the enforcement function
  const handleTimeChange =
    (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const roundedTime = enforceTimeIncrement(e.target.value)
      setter(roundedTime)
    }

  // Handle job form submission
  const onJobSubmit = async (values: z.infer<typeof jobFormSchema>) => {
    if (isEditing && selectedJob) {
      // Edit existing job
      // Check if renaming to an existing job name (other than the current job)
      if (
        values.jobName !== selectedJob &&
        jobs.some((job) => job.name === values.jobName)
      ) {
        toast.error(
          "A job with this name already exists. Please use a unique job name."
        )
        return
      }

      const updatedJobs = jobs.map((job) =>
        job.name === selectedJob
          ? {
              ...job,
              name: values.jobName,
              description: values.description
            }
          : job
      )
      setJobs(updatedJobs)
      await saveJobs(updatedJobs)
      setIsEditing(false)
    } else {
      // Create new job
      // Check if job name already exists
      if (jobs.some((job) => job.name === values.jobName)) {
        toast.error(
          "A job with this name already exists. Please use a unique job name."
        )
        return
      }

      const newJob: Job = {
        name: values.jobName,
        description: values.description,
        time_slots: []
      }
      const updatedJobs = [...jobs, newJob]
      setJobs(updatedJobs)
      await saveJobs(updatedJobs)
    }

    jobForm.reset()
    setIsJobDialogOpen(false)
  }

  // Handle time slot form submission
  const onTimeSlotSubmit = async (
    values: z.infer<typeof timeSlotFormSchema>
  ) => {
    if (!selectedJob) return

    // Format the time slot string
    const formattedStartTime = formatTimeFor12Hour(values.startTime)
    const formattedEndTime = formatTimeFor12Hour(values.endTime)
    const timeSlotString = `${formattedStartTime} - ${formattedEndTime}`

    if (isEditing && selectedTimeSlot) {
      // Edit existing time slot
      const updatedJobs = jobs.map((job) => {
        if (job.name === selectedJob) {
          return {
            ...job,
            time_slots: job.time_slots.map((slot) =>
              slot.time === selectedTimeSlot.time
                ? {
                    ...slot,
                    time: timeSlotString,
                    max_volunteers: values.maxVolunteers
                  }
                : slot
            )
          }
        }
        return job
      })
      setJobs(updatedJobs)
      await saveJobs(updatedJobs)
      setIsEditing(false)
    } else {
      // Create new time slot
      const newTimeSlot: TimeSlot = {
        time: timeSlotString,
        max_volunteers: values.maxVolunteers,
        current_volunteers: []
      }

      const updatedJobs = jobs.map((job) => {
        if (job.name === selectedJob) {
          return {
            ...job,
            time_slots: [...job.time_slots, newTimeSlot]
          }
        }
        return job
      })

      setJobs(updatedJobs)
      await saveJobs(updatedJobs)
    }

    timeSlotForm.reset()
    setIsTimeSlotDialogOpen(false)
  }

  // Delete job
  const confirmDeleteJob = (jobName: string) => {
    setDeleteJobName(jobName)
    setIsDeleteJobDialogOpen(true)
  }

  const deleteJob = async (jobName: string) => {
    const updatedJobs = jobs.filter((job) => job.name !== jobName)
    setJobs(updatedJobs)
    await saveJobs(updatedJobs)
    toast.success("Job deleted successfully")
    setIsDeleteJobDialogOpen(false)
  }

  // Delete time slot
  const confirmDeleteTimeSlot = (jobName: string, timeSlot: string) => {
    setDeleteTimeSlotInfo({ jobName, timeSlot })
    setIsDeleteTimeSlotDialogOpen(true)
  }

  const deleteTimeSlot = async (jobName: string, timeSlot: string) => {
    const updatedJobs = jobs.map((job) => {
      if (job.name === jobName) {
        return {
          ...job,
          time_slots: job.time_slots.filter((slot) => slot.time !== timeSlot)
        }
      }
      return job
    })
    setJobs(updatedJobs)
    await saveJobs(updatedJobs)
    toast.success("Time slot deleted successfully")
    setIsDeleteTimeSlotDialogOpen(false)
  }

  // Remove volunteer
  const confirmRemoveVolunteer = (
    jobName: string,
    timeSlot: string,
    volunteerId: number,
    volunteerName: string
  ) => {
    setDeleteVolunteerInfo({ jobName, timeSlot, volunteerId, volunteerName })
    setIsDeleteVolunteerDialogOpen(true)
  }

  const removeVolunteer = async (
    jobName: string,
    timeSlot: string,
    volunteerId: number
  ) => {
    const updatedJobs = jobs.map((job) => {
      if (job.name === jobName) {
        return {
          ...job,
          time_slots: job.time_slots.map((slot) => {
            if (slot.time === timeSlot) {
              return {
                ...slot,
                current_volunteers: slot.current_volunteers.filter(
                  (v) => v.id !== volunteerId
                )
              }
            }
            return slot
          })
        }
      }
      return job
    })
    setJobs(updatedJobs)
    await saveJobs(updatedJobs)
    toast.success("Volunteer removed successfully")
    setIsDeleteVolunteerDialogOpen(false)
  }

  // Edit job
  const editJob = (job: Job) => {
    setIsEditing(true)
    setSelectedJob(job.name)
    setEditJobName(job.name)
    jobForm.reset({
      jobName: job.name,
      description: job.description || ""
    })
    setIsJobDialogOpen(true)
  }

  // Edit time slot
  const editTimeSlot = (jobName: string, timeSlot: TimeSlot) => {
    setIsEditing(true)
    setSelectedJob(jobName)
    setSelectedTimeSlot(timeSlot)

    // Parse the time slot string (e.g., "7:30pm - 8:30pm")
    const [startTime12h, endTime12h] = timeSlot.time.split(" - ")

    // Convert to 24-hour format for input fields
    const startTime24h = parseTimeFor24Hour(startTime12h)
    const endTime24h = parseTimeFor24Hour(endTime12h)

    timeSlotForm.reset({
      startTime: startTime24h,
      endTime: endTime24h,
      maxVolunteers: timeSlot.max_volunteers
    })

    setIsTimeSlotDialogOpen(true)
  }

  // Save jobs to database
  const saveJobs = async (updatedJobs: Job[]) => {
    try {
      await updateVolunteeringData(eventId, updatedJobs)
      toast.success("Changes saved successfully")
    } catch (error) {
      console.error("Error saving changes:", error)
      toast.error("Failed to save changes")
    }
  }

  const generateTimeSlots = async () => {
    if (selectedJobs.length === 0) {
      toast.error("Please select at least one job")
      return
    }

    if (!generatorStartTime || !generatorEndTime) {
      toast.error("Please select start and end times")
      return
    }

    const startDate = new Date(`2000-01-01T${generatorStartTime}`)
    const endDate = new Date(`2000-01-01T${generatorEndTime}`)

    if (startDate >= endDate) {
      toast.error("End time must be after start time")
      return
    }

    const incrementMinutes = parseInt(generatorIncrement, 10)
    const timeSlots: { startTime: Date; endTime: Date }[] = []

    let currentTime = new Date(startDate)
    while (currentTime < endDate) {
      const slotEndTime = new Date(currentTime)
      slotEndTime.setMinutes(slotEndTime.getMinutes() + incrementMinutes)

      if (slotEndTime > endDate) {
        break
      }

      timeSlots.push({
        startTime: new Date(currentTime),
        endTime: new Date(slotEndTime)
      })

      currentTime = new Date(slotEndTime)
    }

    if (timeSlots.length === 0) {
      toast.error("No time slots could be generated with these settings")
      return
    }

    const updatedJobs = [...jobs]

    // For each selected job, add the generated time slots
    selectedJobs.forEach((jobName) => {
      const jobIndex = updatedJobs.findIndex((job) => job.name === jobName)
      if (jobIndex === -1) return

      timeSlots.forEach((slot) => {
        const startFormatted = formatTimeFor12Hour(
          `${slot.startTime.getHours().toString().padStart(2, "0")}:${slot.startTime.getMinutes().toString().padStart(2, "0")}`
        )
        const endFormatted = formatTimeFor12Hour(
          `${slot.endTime.getHours().toString().padStart(2, "0")}:${slot.endTime.getMinutes().toString().padStart(2, "0")}`
        )
        const timeSlotString = `${startFormatted} - ${endFormatted}`

        // Check if this time slot already exists
        const exists = updatedJobs[jobIndex].time_slots.some(
          (existingSlot) => existingSlot.time === timeSlotString
        )

        if (!exists) {
          updatedJobs[jobIndex].time_slots.push({
            time: timeSlotString,
            max_volunteers: 1,
            current_volunteers: []
          })
        }
      })
    })

    setJobs(updatedJobs)
    await saveJobs(updatedJobs)
    toast.success(
      `${timeSlots.length} time slots generated. Any duplicate time slots were skipped.`
    )
    setIsTimeSlotGeneratorOpen(false)
    setSelectedJobs([])
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {event && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold">{event.title}</h2>
          <p className="text-muted-foreground">
            Manage volunteer positions and time slots for this event
          </p>
        </div>
      )}

      <Tabs defaultValue="jobs" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="jobs">Volunteer Jobs</TabsTrigger>
          <TabsTrigger value="volunteers">Current Volunteers</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isJobDialogOpen} onOpenChange={setIsJobDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    setIsEditing(false)
                    jobForm.reset()
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Job
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {isEditing ? "Edit Job" : "Add Job"}
                  </DialogTitle>
                  <DialogDescription>
                    {isEditing
                      ? `Update job details for ${editJobName}`
                      : "Add a new volunteer job category"}
                  </DialogDescription>
                </DialogHeader>

                <Form {...jobForm}>
                  <form
                    onSubmit={jobForm.handleSubmit(onJobSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={jobForm.control}
                      name="jobName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Security" {...field} />
                          </FormControl>
                          <FormDescription>
                            The name of the volunteer position
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={jobForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Monitor entrance and check IDs"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            A brief description of what this job entails
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit">
                        {isEditing ? "Update Job" : "Add Job"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isTimeSlotGeneratorOpen}
              onOpenChange={setIsTimeSlotGeneratorOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" className="ml-2">
                  <Clock className="mr-2 h-4 w-4" />
                  Generate Time Slots
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Time Slots</DialogTitle>
                  <DialogDescription>
                    Create multiple time slots at once for selected jobs
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Select Jobs</Label>
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                      {jobs.map((job) => (
                        <div
                          key={job.name}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`job-${job.name}`}
                            checked={selectedJobs.includes(job.name)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedJobs([...selectedJobs, job.name])
                              } else {
                                setSelectedJobs(
                                  selectedJobs.filter((j) => j !== job.name)
                                )
                              }
                            }}
                          />
                          <label
                            htmlFor={`job-${job.name}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {job.name}
                          </label>
                        </div>
                      ))}
                    </div>
                    {jobs.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No jobs available. Create a job first.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="generator-start-time">Start Time</Label>
                      <Input
                        id="generator-start-time"
                        type="time"
                        step="1800"
                        value={generatorStartTime}
                        onChange={handleTimeChange(setGeneratorStartTime)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="generator-end-time">End Time</Label>
                      <Input
                        id="generator-end-time"
                        type="time"
                        step="1800"
                        value={generatorEndTime}
                        onChange={handleTimeChange(setGeneratorEndTime)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="generator-increment">Time Increment</Label>
                    <Select
                      value={generatorIncrement}
                      onValueChange={setGeneratorIncrement}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select increment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="150">2.5 hours</SelectItem>
                        <SelectItem value="180">3 hours</SelectItem>
                        <SelectItem value="210">3.5 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                        <SelectItem value="270">4.5 hours</SelectItem>
                        <SelectItem value="300">5 hours</SelectItem>
                        <SelectItem value="330">5.5 hours</SelectItem>
                        <SelectItem value="360">6 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button onClick={generateTimeSlots}>
                    Generate Time Slots
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {jobs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  No volunteer jobs added yet
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click &quot;Add Job&quot; to create your first volunteer position
                </p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {jobs.map((job) => (
                <AccordionItem key={job.name} value={job.name}>
                  <AccordionTrigger className="px-4">
                    <div className="flex flex-col items-start text-left">
                      <div>{job.name}</div>
                      {job.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {job.description}
                        </div>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4">
                    <div className="mb-4 flex justify-between items-center">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => editJob(job)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Job
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmDeleteJob(job.name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Job
                        </Button>
                      </div>
                      <Dialog
                        open={isTimeSlotDialogOpen}
                        onOpenChange={setIsTimeSlotDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditing(false)
                              setSelectedJob(job.name)
                              timeSlotForm.reset()
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Time Slot
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {isEditing ? "Edit Time Slot" : "Add Time Slot"}
                            </DialogTitle>
                            <DialogDescription>
                              {isEditing
                                ? `Update time slot for ${selectedJob}`
                                : `Add a new time slot for ${selectedJob}`}
                            </DialogDescription>
                          </DialogHeader>

                          <Form {...timeSlotForm}>
                            <form
                              onSubmit={timeSlotForm.handleSubmit(
                                onTimeSlotSubmit
                              )}
                              className="space-y-4"
                            >
                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={timeSlotForm.control}
                                  name="startTime"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Start Time</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="time"
                                          step="1800"
                                          {...field}
                                          onChange={(e) => {
                                            const roundedTime =
                                              enforceTimeIncrement(
                                                e.target.value
                                              )
                                            field.onChange(roundedTime)
                                          }}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Times are rounded to nearest 30 min
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={timeSlotForm.control}
                                  name="endTime"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>End Time</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="time"
                                          step="1800"
                                          {...field}
                                          onChange={(e) => {
                                            const roundedTime =
                                              enforceTimeIncrement(
                                                e.target.value
                                              )
                                            field.onChange(roundedTime)
                                          }}
                                        />
                                      </FormControl>
                                      <FormDescription>
                                        Times are rounded to nearest 30 min
                                      </FormDescription>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <FormField
                                control={timeSlotForm.control}
                                name="maxVolunteers"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Max Volunteers</FormLabel>
                                    <FormControl>
                                      <Input type="number" min={1} {...field} />
                                    </FormControl>
                                    <FormDescription>
                                      Maximum number of volunteers needed for
                                      this time slot
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <DialogFooter>
                                <Button type="submit">
                                  {isEditing
                                    ? "Update Time Slot"
                                    : "Add Time Slot"}
                                </Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {job.time_slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No time slots added yet. Click &quot;Add Time Slot&quot; to create
                        one.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {job.time_slots.map((slot) => (
                          <Card key={slot.time}>
                            <CardHeader className="pb-2">
                              <div className="flex justify-between items-center">
                                <CardTitle className="text-md font-medium">
                                  {slot.time}
                                </CardTitle>
                                <div className="flex items-center gap-2 ml-auto">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      editTimeSlot(job.name, slot)
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit</span>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      confirmDeleteTimeSlot(job.name, slot.time)
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">
                                      Delete Time Slot
                                    </span>
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <CardDescription>
                                {slot.current_volunteers.length} of{" "}
                                {slot.max_volunteers} volunteers
                              </CardDescription>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="volunteers" className="space-y-4">
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  No volunteer jobs added yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {jobs.map((job) => (
                <AccordionItem key={`volunteer-${job.name}`} value={job.name}>
                  <AccordionTrigger className="px-4">
                    <div className="flex flex-col items-start text-left">
                      <div>{job.name}</div>
                      {job.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {job.description}
                        </div>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2 pb-4">
                    {job.time_slots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No time slots available
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {job.time_slots.map((slot) => (
                          <Card key={`volunteer-slot-${slot.time}`}>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-md font-medium">
                                {slot.time}
                              </CardTitle>
                              <CardDescription>
                                {slot.current_volunteers.length} of{" "}
                                {slot.max_volunteers} volunteers
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {slot.current_volunteers.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No volunteers signed up yet
                                </p>
                              ) : (
                                <ul className="space-y-2">
                                  {slot.current_volunteers.map((volunteer) => (
                                    <li
                                      key={volunteer.id}
                                      className="flex justify-between items-center p-2 rounded-md border"
                                    >
                                      <div>
                                        <p className="font-medium">
                                          {volunteer.name}{" "}
                                          {volunteer.last_initial}.
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          {volunteer.phone} | {volunteer.email}
                                        </p>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          confirmRemoveVolunteer(
                                            job.name,
                                            slot.time,
                                            volunteer.id,
                                            `${volunteer.name} ${volunteer.last_initial}.`
                                          )
                                        }
                                      >
                                        <UserMinus className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Job Confirmation Dialog */}
      <AlertDialog
        open={isDeleteJobDialogOpen}
        onOpenChange={setIsDeleteJobDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{deleteJobName}&quot; job and all its
              time slots. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteJobName && deleteJob(deleteJobName)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Time Slot Confirmation Dialog */}
      <AlertDialog
        open={isDeleteTimeSlotDialogOpen}
        onOpenChange={setIsDeleteTimeSlotDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{deleteTimeSlotInfo?.timeSlot}&quot;
              time slot from &quot;{deleteTimeSlotInfo?.jobName}&quot;. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTimeSlotInfo &&
                deleteTimeSlot(
                  deleteTimeSlotInfo.jobName,
                  deleteTimeSlotInfo.timeSlot
                )
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Volunteer Confirmation Dialog */}
      <AlertDialog
        open={isDeleteVolunteerDialogOpen}
        onOpenChange={setIsDeleteVolunteerDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Volunteer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {deleteVolunteerInfo?.volunteerName} from the &quot;
              {deleteVolunteerInfo?.timeSlot}&quot; time slot of &quot;
              {deleteVolunteerInfo?.jobName}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteVolunteerInfo &&
                removeVolunteer(
                  deleteVolunteerInfo.jobName,
                  deleteVolunteerInfo.timeSlot,
                  deleteVolunteerInfo.volunteerId
                )
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Volunteer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
