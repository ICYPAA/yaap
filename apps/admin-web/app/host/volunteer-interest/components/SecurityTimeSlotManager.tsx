"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Users, Clock } from "lucide-react"
import { useToast } from "@/components/hooks/use-toast"
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

// Map old 6-hour blocks to new 2-hour slots
const oldBlockToNewSlots: Record<string, string[]> = {
  // Thursday
  "thursday_afternoon": ["thursday_12pm_2pm", "thursday_2pm_4pm", "thursday_4pm_6pm"],
  "thursday_evening": ["thursday_6pm_8pm", "thursday_8pm_10pm", "thursday_10pm_12am"],
  
  // Friday
  "friday_overnight": ["friday_12am_2am", "friday_2am_4am", "friday_4am_6am"],
  "friday_morning": ["friday_6am_8am", "friday_8am_10am", "friday_10am_12pm"],
  "friday_afternoon": ["friday_12pm_2pm", "friday_2pm_4pm", "friday_4pm_6pm"],
  "friday_evening": ["friday_6pm_8pm", "friday_8pm_10pm", "friday_10pm_12am"],
  
  // Saturday
  "saturday_overnight": ["saturday_12am_2am", "saturday_2am_4am", "saturday_4am_6am"],
  "saturday_morning": ["saturday_6am_8am", "saturday_8am_10am", "saturday_10am_12pm"],
  "saturday_afternoon": ["saturday_12pm_2pm", "saturday_2pm_4pm", "saturday_4pm_6pm"],
  "saturday_evening": ["saturday_6pm_8pm", "saturday_8pm_10pm", "saturday_10pm_12am"],
  
  // Sunday
  "sunday_overnight": ["sunday_12am_2am", "sunday_2am_4am", "sunday_4am_6am"],
  "sunday_morning": ["sunday_6am_8am", "sunday_8am_10am", "sunday_10am_12pm"]
}

// Define time blocks and their 2-hour slots
const timeBlocks = {
  Thursday: [
    { 
      block: "Afternoon (12pm-6pm)", 
      slots: ["12pm-2pm", "2pm-4pm", "4pm-6pm"],
      blockId: "thursday_afternoon"
    },
    { 
      block: "Evening (6pm-12am)", 
      slots: ["6pm-8pm", "8pm-10pm", "10pm-12am"],
      blockId: "thursday_evening"
    }
  ],
  Friday: [
    { 
      block: "Overnight (12am-6am)", 
      slots: ["12am-2am", "2am-4am", "4am-6am"],
      blockId: "friday_overnight"
    },
    { 
      block: "Morning (6am-12pm)", 
      slots: ["6am-8am", "8am-10am", "10am-12pm"],
      blockId: "friday_morning"
    },
    { 
      block: "Afternoon (12pm-6pm)", 
      slots: ["12pm-2pm", "2pm-4pm", "4pm-6pm"],
      blockId: "friday_afternoon"
    },
    { 
      block: "Evening (6pm-12am)", 
      slots: ["6pm-8pm", "8pm-10pm", "10pm-12am"],
      blockId: "friday_evening"
    }
  ],
  Saturday: [
    { 
      block: "Overnight (12am-6am)", 
      slots: ["12am-2am", "2am-4am", "4am-6am"],
      blockId: "saturday_overnight"
    },
    { 
      block: "Morning (6am-12pm)", 
      slots: ["6am-8am", "8am-10am", "10am-12pm"],
      blockId: "saturday_morning"
    },
    { 
      block: "Afternoon (12pm-6pm)", 
      slots: ["12pm-2pm", "2pm-4pm", "4pm-6pm"],
      blockId: "saturday_afternoon"
    },
    { 
      block: "Evening (6pm-12am)", 
      slots: ["6pm-8pm", "8pm-10pm", "10pm-12am"],
      blockId: "saturday_evening"
    }
  ],
  Sunday: [
    { 
      block: "Overnight (12am-6am)", 
      slots: ["12am-2am", "2am-4am", "4am-6am"],
      blockId: "sunday_overnight"
    },
    { 
      block: "Morning (6am-12pm)", 
      slots: ["6am-8am", "8am-10am", "10am-12pm"],
      blockId: "sunday_morning"
    }
  ]
}

interface Volunteer {
  id: string
  name: string
  last_initial: string
  phone?: string
  email?: string
  timeSlots: string[]
}

interface TimeSlotAssignment {
  id: string
  volunteer_id: string
  volunteer_name: string
  day: string
  block: string
  slot: string
  assigned_at: string
}

interface SecurityTimeSlotManagerProps {
  volunteers: Volunteer[]
  assignments: TimeSlotAssignment[]
  onAddAssignment: (volunteerId: string, day: string, block: string, slot: string) => Promise<void>
  onRemoveAssignment: (assignmentId: string) => Promise<void>
}

export default function SecurityTimeSlotManager({
  volunteers,
  assignments,
  onAddAssignment,
  onRemoveAssignment
}: SecurityTimeSlotManagerProps) {
  const { toast } = useToast()
  const [selectedDay, setSelectedDay] = useState<string>("")
  const [selectedBlock, setSelectedBlock] = useState<string>("")
  const [selectedSlot, setSelectedSlot] = useState<string>("")
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [assignmentToRemove, setAssignmentToRemove] = useState<TimeSlotAssignment | null>(null)

  // Helper function to check if a volunteer uses old format (6-hour blocks) or new format (2-hour slots)
  const usesOldFormat = (volunteer: Volunteer): boolean => {
    // Check if any of their timeSlots match the old block format (e.g., "thursday_afternoon")
    return volunteer.timeSlots.some(slot => 
      Object.keys(oldBlockToNewSlots).includes(slot)
    )
  }

  // Get volunteers available for a specific time block
  const getAvailableVolunteers = (day: string, blockId: string, block: string) => {
    // Get all assignments for this day and block
    const blockAssignments = assignments.filter(
      a => a.day === day && a.block === block
    )
    
    // Filter out volunteers who are already assigned to ANY slot in this block
    return volunteers.filter(volunteer => {
      // Check if volunteer is available for this time block
      let isAvailable = false
      
      if (usesOldFormat(volunteer)) {
        // Old format: check if they have the 6-hour block
        isAvailable = volunteer.timeSlots.includes(blockId)
      } else {
        // New format: check if they have any of the 2-hour slots in this block
        const blockSlots = oldBlockToNewSlots[blockId] || []
        isAvailable = volunteer.timeSlots.some(slot => blockSlots.includes(slot))
      }
      
      if (!isAvailable) return false
      
      // Check if volunteer is already assigned to any slot in this block
      const isAlreadyAssigned = blockAssignments.some(
        a => a.volunteer_id === volunteer.id
      )
      
      return !isAlreadyAssigned
    })
  }

  // Get assignments for a specific slot
  const getSlotAssignments = (day: string, block: string, slot: string): TimeSlotAssignment[] => {
    return assignments.filter(
      a => a.day === day && a.block === block && a.slot === slot
    )
  }

  // Handle adding a volunteer to a slot
  const handleAddVolunteer = async () => {
    if (!selectedVolunteer || !selectedDay || !selectedBlock || !selectedSlot) {
      toast({
        title: "Missing Information",
        description: "Please select a volunteer and time slot.",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      await onAddAssignment(selectedVolunteer, selectedDay, selectedBlock, selectedSlot)
      toast({
        title: "Volunteer Added",
        description: "Volunteer has been assigned to the time slot."
      })
      setIsAddModalOpen(false)
      resetModalState()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add volunteer to time slot.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle removing a volunteer from a slot
  const handleRemoveVolunteer = async () => {
    if (!assignmentToRemove) return

    setIsLoading(true)
    try {
      await onRemoveAssignment(assignmentToRemove.id)
      toast({
        title: "Volunteer Removed",
        description: "Volunteer has been removed from the time slot."
      })
      setAssignmentToRemove(null)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove volunteer from time slot.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const resetModalState = () => {
    setSelectedDay("")
    setSelectedBlock("")
    setSelectedSlot("")
    setSelectedVolunteer("")
  }

  const openAddModal = (day: string, block: string, slot: string) => {
    setSelectedDay(day)
    setSelectedBlock(block)
    setSelectedSlot(slot)
    setIsAddModalOpen(true)
  }

  // Get volunteers with new 2-hour format that haven't been assigned yet
  const getUnassignedNewFormatVolunteers = () => {
    return volunteers.filter(volunteer => {
      // Only include volunteers using new format
      if (usesOldFormat(volunteer)) return false
      
      // Check if they have any assignments
      const hasAssignment = assignments.some(a => a.volunteer_id === volunteer.id)
      return !hasAssignment
    })
  }

  // Auto-assign volunteers with new format to their selected slots
  const handleAutoAssign = async () => {
    const unassignedVolunteers = getUnassignedNewFormatVolunteers()
    
    if (unassignedVolunteers.length === 0) {
      toast({
        title: "No Volunteers to Auto-Assign",
        description: "All volunteers with 2-hour slot preferences have been assigned.",
      })
      return
    }

    setIsLoading(true)
    let successCount = 0
    let errorCount = 0

    for (const volunteer of unassignedVolunteers) {
      for (const slot of volunteer.timeSlots) {
        // Parse the slot format (e.g., "friday_2pm_4pm")
        const parts = slot.split('_')
        if (parts.length < 3) continue
        
        const day = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
        const timeRange = `${parts[1]}-${parts[2]}`
        
        // Find the corresponding block for this slot
        let blockName = ""
        let found = false
        
        for (const [blockId, slots] of Object.entries(oldBlockToNewSlots)) {
          if (slots.includes(slot)) {
            // Find the block name from timeBlocks
            for (const [d, blocks] of Object.entries(timeBlocks)) {
              if (d === day) {
                const block = blocks.find(b => b.blockId === blockId)
                if (block) {
                  blockName = block.block
                  found = true
                  break
                }
              }
            }
            if (found) break
          }
        }
        
        if (blockName) {
          // Check if slot is already taken
          const existingAssignment = assignments.find(
            a => a.day === day && a.block === blockName && a.slot === timeRange
          )
          
          if (!existingAssignment) {
            try {
              await onAddAssignment(volunteer.id, day, blockName, timeRange)
              successCount++
              break // Only assign to first available slot
            } catch (error) {
              errorCount++
            }
          }
        }
      }
    }

    setIsLoading(false)
    
    if (successCount > 0) {
      toast({
        title: "Auto-Assignment Complete",
        description: `Successfully assigned ${successCount} volunteer${successCount !== 1 ? 's' : ''}.${errorCount > 0 ? ` Failed to assign ${errorCount}.` : ''}`,
      })
    } else {
      toast({
        title: "Auto-Assignment Failed",
        description: "Could not assign any volunteers. Slots may be full.",
        variant: "destructive"
      })
    }
  }

  const unassignedNewFormatCount = getUnassignedNewFormatVolunteers().length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Security Time Slot Management</h3>
        <div className="flex items-center gap-2">
          {unassignedNewFormatCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoAssign}
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Auto-Assign {unassignedNewFormatCount} New Volunteers
            </Button>
          )}
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {assignments.length} Total Assignments
          </Badge>
        </div>
      </div>

      <div className="grid gap-4">
        {Object.entries(timeBlocks).map(([day, blocks]) => (
          <div key={day} className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">{day}</h4>
            <div className="grid gap-4 md:grid-cols-2">
              {blocks.map((blockInfo) => (
                <Card key={`${day}-${blockInfo.blockId}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {blockInfo.block}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {getAvailableVolunteers(day, blockInfo.blockId, blockInfo.block).length} available
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {blockInfo.slots.map((slot) => {
                      const slotAssignments = getSlotAssignments(day, blockInfo.block, slot)
                      return (
                        <div
                          key={slot}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{slot}</span>
                              <Badge variant="outline" className="text-xs">
                                {slotAssignments.length} assigned
                              </Badge>
                            </div>
                            <div className="mt-2 space-y-1">
                              {slotAssignments.map((assignment) => (
                                <div
                                  key={assignment.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <Badge variant="secondary" className="text-xs">
                                    {assignment.volunteer_name}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0"
                                    onClick={() => setAssignmentToRemove(assignment)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAddModal(day, blockInfo.block, slot)}
                            className="ml-2"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Volunteer Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Volunteer to Time Slot</DialogTitle>
            <DialogDescription>
              Assign a volunteer to {selectedDay} {selectedSlot} during {selectedBlock}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Volunteer</label>
              <Select value={selectedVolunteer} onValueChange={setSelectedVolunteer}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a volunteer..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedDay && selectedBlock && getAvailableVolunteers(
                    selectedDay,
                    timeBlocks[selectedDay as keyof typeof timeBlocks]
                      .find(b => b.block === selectedBlock)?.blockId || "",
                    selectedBlock
                  ).map((volunteer) => (
                    <SelectItem key={volunteer.id} value={volunteer.id}>
                      {volunteer.name} {volunteer.last_initial}
                      {volunteer.phone && ` - ${volunteer.phone}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddModalOpen(false)
                  resetModalState()
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddVolunteer} disabled={isLoading}>
                {isLoading ? "Adding..." : "Add Volunteer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Volunteer Confirmation */}
      <AlertDialog open={!!assignmentToRemove} onOpenChange={() => setAssignmentToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Volunteer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {assignmentToRemove?.volunteer_name} from this time slot?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveVolunteer}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Show unassigned volunteers with new format */}
      {unassignedNewFormatCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Unassigned Volunteers (New 2-Hour Format)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getUnassignedNewFormatVolunteers().map((volunteer) => (
                <div key={volunteer.id} className="flex items-center justify-between p-2 rounded border">
                  <div>
                    <span className="font-medium">{volunteer.name} {volunteer.last_initial}</span>
                    <div className="text-sm text-muted-foreground mt-1">
                      Available slots: {volunteer.timeSlots.map(slot => {
                        const parts = slot.split('_')
                        if (parts.length >= 3) {
                          return `${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)} ${parts[1]}-${parts[2]}`
                        }
                        return slot
                      }).join(', ')}
                    </div>
                  </div>
                  <Badge variant="outline">Ready to Assign</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}