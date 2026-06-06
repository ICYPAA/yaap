"use client"

import { useToast } from "@/components/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { ArrowDown, ArrowUp, Loader2, MessageSquare } from "lucide-react"
import { useEffect, useState } from "react"
import {
  getIC2025VolunteerInterest,
  updateIC2025VolunteerStatus
} from "./actions"

// Define the structure of a conference volunteer interest record.
interface IC2025VolunteerInterest {
  id: string
  name: string
  last_initial: string
  phone: string | null
  email: string | null
  type: "ic2025"
  status?: string
  data: {
    group_name: string
    day: string
    time_slot: string
    comments: string
  }
  created_at: string
}

// Define sort configuration type
interface SortConfig {
  key: keyof IC2025VolunteerInterest | "timeSlot"
  direction: "asc" | "desc"
}

export default function IC2025VolunteerInterestPage() {
  const [volunteerData, setVolunteerData] = useState<IC2025VolunteerInterest[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc"
  })
  const [hasAccessToSensitiveData, setHasAccessToSensitiveData] =
    useState(false)

  const { toast } = useToast()

  useEffect(() => {
    async function loadIC2025VolunteerInterest() {
      try {
        setLoading(true)
        const result = await getIC2025VolunteerInterest()
        setVolunteerData(result.data || [])
        setHasAccessToSensitiveData(result.hasAccessToSensitive || false)
        setLoading(false)
      } catch (error) {
        console.error("Error loading conference volunteer interest data:", error)
        toast({
          title: "Error",
          description: "Failed to load conference volunteer interest data.",
          variant: "destructive"
        })
        setLoading(false)
      }
    }

    loadIC2025VolunteerInterest()
  }, [toast])

  // Sort the volunteer data based on the sort config
  const getSortedVolunteers = () => {
    return [...volunteerData].sort((a, b) => {
      if (sortConfig.key === "created_at") {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return sortConfig.direction === "asc" ? dateA - dateB : dateB - dateA
      }

      if (sortConfig.key === "timeSlot") {
        // Sort by time slot
        const timeSlotA = `${a.data.day} ${a.data.time_slot}`
        const timeSlotB = `${b.data.day} ${b.data.time_slot}`
        return sortConfig.direction === "asc"
          ? timeSlotA.localeCompare(timeSlotB)
          : timeSlotB.localeCompare(timeSlotA)
      }

      // For basic string properties
      const valA = a[sortConfig.key as keyof IC2025VolunteerInterest] as string
      const valB = b[sortConfig.key as keyof IC2025VolunteerInterest] as string

      return sortConfig.direction === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA)
    })
  }

  // Function to handle sorting when a column header is clicked
  const handleSort = (key: keyof IC2025VolunteerInterest | "timeSlot") => {
    const newDirectionValue =
      sortConfig.key === key && sortConfig.direction === "asc"
        ? ("desc" as const)
        : ("asc" as const)

    setSortConfig({
      key,
      direction: newDirectionValue
    })
  }

  // Function to render sort indicator
  const renderSortIndicator = (
    key: keyof IC2025VolunteerInterest | "timeSlot"
  ) => {
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
      await updateIC2025VolunteerStatus(id, newStatus)

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

  // Function to render comments
  const renderComments = (volunteer: IC2025VolunteerInterest) => {
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

  const sortedVolunteers = getSortedVolunteers()

  return (
    <div className="container py-10">
      <h1 className="text-2xl font-bold mb-6">Conference Volunteer Interest</h1>

      <Card>
        <CardHeader>
          <CardTitle>Conference Volunteers</CardTitle>
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
                        onClick={() => handleSort("name")}
                      >
                        Name {renderSortIndicator("name")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("last_initial")}
                      >
                        Last Initial {renderSortIndicator("last_initial")}
                      </TableHead>
                      {hasAccessToSensitiveData && (
                        <TableHead className="whitespace-nowrap">
                          Contact Info
                        </TableHead>
                      )}
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("timeSlot")}
                      >
                        Time Slot {renderSortIndicator("timeSlot")}
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Group/Meeting
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Comments
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("status")}
                      >
                        Status {renderSortIndicator("status")}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort("created_at")}
                      >
                        Submitted {renderSortIndicator("created_at")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVolunteers.length > 0 ? (
                      sortedVolunteers.map((volunteer) => (
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
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {volunteer.data.day} - {volunteer.data.time_slot}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {volunteer.data.group_name || (
                              <span className="text-muted-foreground">
                                None
                              </span>
                            )}
                          </TableCell>
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
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={hasAccessToSensitiveData ? 8 : 7}
                          className="text-center py-6"
                        >
                          No conference volunteer interest data found.
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
    </div>
  )
}
