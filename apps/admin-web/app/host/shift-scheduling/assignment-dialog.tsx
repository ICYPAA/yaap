"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, UserPlus, Clock, MapPin, AlertTriangle, Star, X, CheckCircle } from "lucide-react"
import { format, differenceInMinutes } from "date-fns"

interface AssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: any | null
  registeredVolunteers: any[]
  previousVolunteers: any[]
  onAssign: (shift: any, volunteer: any) => void
  onRemove: (shift: any, assignmentId: string) => void
  shifts: any[]
}

export default function AssignmentDialog({
  open,
  onOpenChange,
  shift,
  registeredVolunteers,
  previousVolunteers,
  onAssign,
  onRemove,
  shifts
}: AssignmentDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [newVolunteerName, setNewVolunteerName] = useState("")
  const [newVolunteerEmail, setNewVolunteerEmail] = useState("")

  const getSuitabilityScore = (volunteer: any) => {
    if (!shift) return 0
    
    let score = 0
    
    const hasConflict = shifts.some(s => {
      if (s.id === shift.id) return false
      const hasVolunteer = s.shift_assignments.some((a: any) => 
        (volunteer.id && a.volunteer_id === volunteer.id) ||
        (volunteer.email && a.volunteer_email === volunteer.email)
      )
      if (!hasVolunteer) return false
      
      const shiftStart = new Date(shift.start_time)
      const shiftEnd = new Date(shift.end_time)
      const sStart = new Date(s.start_time)
      const sEnd = new Date(s.end_time)
      
      return shiftStart < sEnd && shiftEnd > sStart
    })
    
    if (!hasConflict) score += 20
    
    const totalShifts = shifts.filter(s => 
      s.shift_assignments.some((a: any) => 
        (volunteer.id && a.volunteer_id === volunteer.id) ||
        (volunteer.email && a.volunteer_email === volunteer.email)
      )
    ).length
    
    if (totalShifts < 3) score += 5
    
    if (volunteer.id) score += 3
    
    return score
  }

  const getConflicts = (volunteer: any) => {
    if (!shift) return []
    
    return shifts.filter(s => {
      if (s.id === shift.id) return false
      const hasVolunteer = s.shift_assignments.some((a: any) => 
        (volunteer.id && a.volunteer_id === volunteer.id) ||
        (volunteer.email && a.volunteer_email === volunteer.email)
      )
      if (!hasVolunteer) return false
      
      const shiftStart = new Date(shift.start_time)
      const shiftEnd = new Date(shift.end_time)
      const sStart = new Date(s.start_time)
      const sEnd = new Date(s.end_time)
      
      return shiftStart < sEnd && shiftEnd > sStart
    })
  }

  const suggestions = useMemo(() => {
    if (!shift) return []
    
    const allVolunteers = [
      ...registeredVolunteers.map(v => ({
        ...v,
        email: v.email || "",
        isHost: true
      })),
      ...previousVolunteers.map(v => ({
        id: null,
        full_name: v.volunteer_name,
        volunteer_name: v.volunteer_name,
        email: v.volunteer_email || "",
        volunteer_email: v.volunteer_email,
        isHost: false
      }))
    ]
    
    const alreadyAssigned = shift.shift_assignments.map((a: any) => a.volunteer_email || a.volunteer_id)
    
    return allVolunteers
      .filter(v => {
        const identifier = v.id || v.email || v.volunteer_email
        return !alreadyAssigned.includes(identifier)
      })
      .filter(v => {
        if (!searchQuery) return true
        const name = v.full_name || v.volunteer_name || ""
        const email = v.email || v.volunteer_email || ""
        return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
               email.toLowerCase().includes(searchQuery.toLowerCase())
      })
      .map(v => ({
        ...v,
        score: getSuitabilityScore(v),
        conflicts: getConflicts(v)
      }))
      .sort((a, b) => b.score - a.score)
  }, [shift, registeredVolunteers, previousVolunteers, searchQuery, shifts])

  const handleAddNewVolunteer = () => {
    if (!newVolunteerName || !shift) return
    
    const newVolunteer = {
      volunteer_name: newVolunteerName,
      volunteer_email: newVolunteerEmail || null,
      full_name: newVolunteerName,
      email: newVolunteerEmail
    }
    
    onAssign(shift, newVolunteer)
    setNewVolunteerName("")
    setNewVolunteerEmail("")
  }

  if (!shift) return null

  const needsCoverage = shift.shift_assignments.length < shift.min_volunteers

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="space-y-2">
            <div>{shift.name}</div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-normal">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(new Date(shift.start_time), "MMM d, HH:mm")} - {format(new Date(shift.end_time), "HH:mm")}
              </div>
              {shift.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {shift.location}
                </div>
              )}
              <Badge variant={shift.job_types?.color ? "default" : "secondary"}>
                {shift.job_types?.name}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="assigned" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="assigned">
              Assigned ({shift.shift_assignments.length}/{shift.max_volunteers})
            </TabsTrigger>
            <TabsTrigger value="suggestions">
              Suggestions
            </TabsTrigger>
            <TabsTrigger value="add">
              Add New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assigned" className="space-y-2">
            {needsCoverage && (
              <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950 rounded-md">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-600">
                  Need {shift.min_volunteers - shift.shift_assignments.length} more volunteer(s)
                </span>
              </div>
            )}
            
            {shift.shift_assignments.length > 0 ? (
              <ScrollArea className="h-[300px] w-full">
                <div className="space-y-2">
                  {shift.shift_assignments.map((assignment: any) => (
                    <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-2">
                        {assignment.is_host_member && (
                          <Badge variant="default">Host</Badge>
                        )}
                        <div>
                          <p className="font-medium">{assignment.volunteer_name}</p>
                          {assignment.volunteer_email && (
                            <p className="text-sm text-muted-foreground">{assignment.volunteer_email}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {assignment.status === "confirmed" && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemove(shift, assignment.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No volunteers assigned yet
              </p>
            )}
          </TabsContent>

          <TabsContent value="suggestions">
            <div className="space-y-2">
              <Input
                placeholder="Search volunteers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              
              <ScrollArea className="h-[350px] w-full">
                <div className="space-y-2">
                  {suggestions.map((volunteer, idx) => (
                    <div 
                      key={volunteer.id || volunteer.email || idx}
                      className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {volunteer.full_name || volunteer.volunteer_name}
                          </p>
                          {volunteer.isHost && (
                            <Badge variant="default" className="text-xs">Host</Badge>
                          )}
                          {volunteer.score >= 20 && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Best fit
                            </Badge>
                          )}
                        </div>
                        {volunteer.email && (
                          <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                        )}
                        {volunteer.conflicts.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                            <span className="text-xs text-orange-500">
                              Conflicts with: {volunteer.conflicts.map((c: any) => c.name).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => onAssign(shift, volunteer)}
                        disabled={shift.shift_assignments.length >= shift.max_volunteers}
                      >
                        Assign
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <div>
              <Label htmlFor="new-name">Name *</Label>
              <Input
                id="new-name"
                placeholder="Enter volunteer name"
                value={newVolunteerName}
                onChange={(e) => setNewVolunteerName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-email">Email (optional)</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="volunteer@example.com"
                value={newVolunteerEmail}
                onChange={(e) => setNewVolunteerEmail(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleAddNewVolunteer}
              disabled={!newVolunteerName || shift.shift_assignments.length >= shift.max_volunteers}
              className="w-full"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Volunteer
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}