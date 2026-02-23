"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, UserCheck, Clock, MapPin, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { Shift, Volunteer } from "../types"
import { generateAutoAssignments, applyAutoAssignments } from "../utils/auto-assign"

interface AutoApplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shifts: Shift[]
  volunteers: Volunteer[]
  onApply: (updatedShifts: Shift[]) => void
}

export default function AutoApplyDialog({
  open,
  onOpenChange,
  shifts,
  volunteers,
  onApply
}: AutoApplyDialogProps) {
  const [assignments, setAssignments] = useState<ReturnType<typeof generateAutoAssignments>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [expandedShifts, setExpandedShifts] = useState<Set<string>>(new Set())

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => {
      const generated = generateAutoAssignments(shifts, volunteers)
      setAssignments(generated)
      setIsGenerating(false)
    }, 100)
  }

  const handleApply = () => {
    const updatedShifts = applyAutoAssignments(shifts, assignments)
    onApply(updatedShifts)
    onOpenChange(false)
    setAssignments([])
  }

  const toggleShiftExpanded = (shiftId: string) => {
    const newExpanded = new Set(expandedShifts)
    if (newExpanded.has(shiftId)) {
      newExpanded.delete(shiftId)
    } else {
      newExpanded.add(shiftId)
    }
    setExpandedShifts(newExpanded)
  }

  // Group assignments by shift for better visualization
  const assignmentsByShift = assignments.reduce((acc, assignment) => {
    const shiftId = assignment.shift.id
    if (!acc[shiftId]) {
      acc[shiftId] = {
        shift: assignment.shift,
        volunteers: []
      }
    }
    acc[shiftId].volunteers.push({
      volunteer: assignment.volunteer,
      reason: assignment.reason
    })
    return acc
  }, {} as Record<string, { shift: Shift; volunteers: Array<{ volunteer: Volunteer; reason: string }> }>)

  const sortedShifts = Object.values(assignmentsByShift).sort((a, b) => {
    if (a.shift.date !== b.shift.date) {
      return a.shift.date.localeCompare(b.shift.date)
    }
    return a.shift.start_time.localeCompare(b.shift.start_time)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Auto-Assign Volunteers
          </DialogTitle>
          <DialogDescription>
            Automatically match volunteers to shifts based on their specific volunteer type (Registration, Security, Merch, Marathon Meetings).
            Note: General interest and Hospitality volunteers are excluded from auto-assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {assignments.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <UserCheck className="h-16 w-16 text-muted-foreground/30" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">Generate Auto-Assignments</p>
                <p className="text-sm text-muted-foreground">
                  Match unassigned volunteers to appropriate shifts based on their interests
                </p>
              </div>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? "Generating..." : "Generate Preview"}
              </Button>
            </div>
          ) : (
            <>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Review the {assignments.length} suggested assignment{assignments.length !== 1 ? 's' : ''} below. 
                  You can apply all or cancel to make manual adjustments.
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-[400px] w-full border rounded-lg p-4">
                <div className="space-y-3">
                  {sortedShifts.map(({ shift, volunteers }) => {
                    const isExpanded = expandedShifts.has(shift.id)
                    const currentTotal = shift.assignments.length
                    const newTotal = currentTotal + volunteers.length
                    
                    return (
                      <div key={shift.id} className="border rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleShiftExpanded(shift.id)}
                          className="w-full p-3 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 mt-0.5" />
                              ) : (
                                <ChevronRight className="h-4 w-4 mt-0.5" />
                              )}
                              <div className="space-y-1">
                                <div className="font-medium">{shift.job_type}</div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {new Date(shift.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  {' '}
                                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                  {shift.location && shift.location.length > 0 && (
                                    <>
                                      <MapPin className="h-3 w-3 ml-1" />
                                      {shift.location.join(', ')}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                +{volunteers.length} new
                              </Badge>
                              <Badge variant={newTotal > shift.max_volunteers ? "destructive" : "default"}>
                                {currentTotal} → {newTotal} / {shift.max_volunteers}
                              </Badge>
                            </div>
                          </div>
                        </button>
                        
                        {isExpanded && (
                          <div className="border-t bg-muted/20 p-3 space-y-2">
                            {volunteers.map(({ volunteer, reason }) => (
                              <div key={volunteer.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {volunteer.type}
                                  </Badge>
                                  <span>{volunteer.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{reason}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssignments([])}>
                  Clear Preview
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleApply}>
                  Apply {assignments.length} Assignment{assignments.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}