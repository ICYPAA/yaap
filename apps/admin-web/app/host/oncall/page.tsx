"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  Calendar,
  Clock,
  Edit,
  Loader2,
  Phone,
  Plus,
  Trash2,
  User,
  Users
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  addOncallSchedule,
  deleteOncallSchedule,
  getOncallSchedules,
  updateOncallSchedule,
  type OncallSchedule
} from "./actions"
import { createClient } from "@/utils/supabase/client"

export default function OncallPage() {
  const [schedules, setSchedules] = useState<OncallSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<OncallSchedule | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newSchedule, setNewSchedule] = useState({
    startTime: "",
    endTime: "",
    phone: ""
  })

  useEffect(() => {
    loadSchedules()
  }, [])

  const loadSchedules = async () => {
    setIsLoading(true)
    try {
      const data = await getOncallSchedules()
      setSchedules(data)
    } catch (error) {
      console.error("Error loading schedules:", error)
      toast.error("Failed to load oncall schedules")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddSchedule = async () => {
    if (!newSchedule.startTime || !newSchedule.endTime) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await addOncallSchedule({
        start_time: newSchedule.startTime,
        end_time: newSchedule.endTime,
        phone: newSchedule.phone || null
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Oncall schedule added successfully")
        setShowAddDialog(false)
        setNewSchedule({ startTime: "", endTime: "", phone: "" })
        loadSchedules()
      }
    } catch (error) {
      toast.error("Failed to add oncall schedule")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSchedule = async () => {
    if (!editingSchedule) return

    setIsSubmitting(true)
    try {
      const result = await updateOncallSchedule(editingSchedule.id, {
        start_time: editingSchedule.start_time,
        end_time: editingSchedule.end_time,
        phone: editingSchedule.phone
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Schedule updated successfully")
        setShowEditDialog(false)
        setEditingSchedule(null)
        loadSchedules()
      }
    } catch (error) {
      toast.error("Failed to update schedule")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSchedule = async (id: number) => {
    if (!confirm("Are you sure you want to delete this oncall schedule?")) return

    try {
      const result = await deleteOncallSchedule(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Schedule deleted successfully")
        loadSchedules()
      }
    } catch (error) {
      toast.error("Failed to delete schedule")
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    })
  }

  const isCurrentlyOncall = (schedule: OncallSchedule) => {
    const now = new Date()
    const start = new Date(schedule.start_time)
    const end = new Date(schedule.end_time)
    return now >= start && now <= end
  }

  // Since we're in the host folder, all users here have permission
  const canEditSchedule = (schedule: OncallSchedule) => {
    return true // All host members can manage schedules
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">On-Call Schedule</h1>
          <p className="text-muted-foreground">
            View and manage on-call schedules for committee members
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Schedule
            </Button>
          </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add On-Call Schedule</DialogTitle>
                <DialogDescription>
                  Set your on-call availability period
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="start-time">Start Time *</Label>
                  <Input
                    id="start-time"
                    type="datetime-local"
                    value={newSchedule.startTime}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, startTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">End Time *</Label>
                  <Input
                    id="end-time"
                    type="datetime-local"
                    value={newSchedule.endTime}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, endTime: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Contact Phone (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={newSchedule.phone}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, phone: e.target.value })
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddDialog(false)
                      setNewSchedule({ startTime: "", endTime: "", phone: "" })
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddSchedule} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Adding...
                      </>
                    ) : (
                      "Add Schedule"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Current & Upcoming On-Call Schedules
          </CardTitle>
          <CardDescription>
            Committee members available for on-call support
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No on-call schedules available at the moment.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => {
                    const isActive = isCurrentlyOncall(schedule)
                    const canEdit = canEditSchedule(schedule)
                    
                    return (
                      <TableRow key={schedule.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={schedule.avatar_url || ""} />
                              <AvatarFallback>
                                {schedule.display_name?.[0] || "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {schedule.display_name || "Unknown User"}
                              </div>
                              {schedule.discord_username && (
                                <div className="text-sm text-muted-foreground">
                                  @{schedule.discord_username}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDateTime(schedule.start_time)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {formatDateTime(schedule.end_time)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {schedule.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {schedule.phone}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isActive ? (
                            <Badge className="bg-green-600">On Call Now</Badge>
                          ) : new Date(schedule.start_time) > new Date() ? (
                            <Badge variant="outline">Upcoming</Badge>
                          ) : (
                            <Badge variant="secondary">Past</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                            {canEdit && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingSchedule(schedule)
                                    setShowEditDialog(true)
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteSchedule(schedule.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit On-Call Schedule</DialogTitle>
            <DialogDescription>
              Update your on-call availability period
            </DialogDescription>
          </DialogHeader>
          {editingSchedule && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-start-time">Start Time *</Label>
                <Input
                  id="edit-start-time"
                  type="datetime-local"
                  value={editingSchedule.start_time.slice(0, 16)}
                  onChange={(e) =>
                    setEditingSchedule({
                      ...editingSchedule,
                      start_time: e.target.value
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-end-time">End Time *</Label>
                <Input
                  id="edit-end-time"
                  type="datetime-local"
                  value={editingSchedule.end_time.slice(0, 16)}
                  onChange={(e) =>
                    setEditingSchedule({
                      ...editingSchedule,
                      end_time: e.target.value
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Contact Phone (Optional)</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={editingSchedule.phone || ""}
                  onChange={(e) =>
                    setEditingSchedule({
                      ...editingSchedule,
                      phone: e.target.value
                    })
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false)
                    setEditingSchedule(null)
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleEditSchedule} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    "Update Schedule"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}