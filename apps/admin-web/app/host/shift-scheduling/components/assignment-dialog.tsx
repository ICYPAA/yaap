"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { User, Clock, MapPin, AlertTriangle, X, Users, Star, CheckCircle, Info, Edit2, Trash2 } from "lucide-react"
import { Shift, Volunteer } from "../types"
import { getVolunteerSuggestions, findConflictingShifts } from "../utils/scheduling"
import { formatTime12Hour } from "../utils/time-format"

interface AssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: Shift | null
  allVolunteers: Volunteer[]
  onAssign: (shift: Shift, volunteer: Volunteer) => void
  onRemove: (shift: Shift, volunteerId: string) => void
  onEdit?: (shift: Shift) => void
  onDelete?: (shift: Shift) => void
  shifts: Shift[]
}

export default function AssignmentDialog({
  open,
  onOpenChange,
  shift,
  allVolunteers,
  onAssign,
  onRemove,
  onEdit,
  onDelete,
  shifts
}: AssignmentDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [interestsSearchQuery, setInterestsSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [interestsFilterType, setInterestsFilterType] = useState<string>("all")
  const [showConflictConfirm, setShowConflictConfirm] = useState<{volunteer: Volunteer, conflicts: Shift[]} | null>(null)

  const getVolunteerBadgeColor = (type: string) => {
    switch (type) {
      case 'host': return 'default'
      case 'hospitality': return 'secondary'
      case 'panel_chair': return 'outline'
      case 'panelist': return 'outline'
      default: return 'secondary'
    }
  }

  const suggestions = useMemo(() => {
    if (!shift) return []
    
    // Get suggestions with scores
    let scoredVolunteers = getVolunteerSuggestions(shift, allVolunteers, shifts)
    
    // Apply search filter
    if (searchQuery) {
      scoredVolunteers = scoredVolunteers.filter(v => 
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.contact_info?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Apply type filter
    if (filterType !== "all") {
      scoredVolunteers = scoredVolunteers.filter(v => v.type === filterType)
    }
    
    return scoredVolunteers
  }, [shift, allVolunteers, shifts, searchQuery, filterType])

  const handleAssignClick = (volunteer: Volunteer) => {
    if (!shift) return
    
    // Check for conflicts
    const conflicts = findConflictingShifts(
      volunteer.id,
      shift.date,
      shift.start_time,
      shift.end_time,
      shifts,
      shift.id
    )
    
    if (conflicts.length > 0) {
      setShowConflictConfirm({ volunteer, conflicts })
    } else {
      onAssign(shift, volunteer)
    }
  }

  if (!shift) return null

  const needsCoverage = shift.assignments.length < shift.min_volunteers

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[85vh]">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <DialogTitle className="space-y-2 flex-1">
                <div>{shift.job_type}</div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground font-normal">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatTime12Hour(shift.start_time)} - {formatTime12Hour(shift.end_time)}
                  </div>
                  <Badge variant={needsCoverage ? "destructive" : "default"}>
                    {shift.assignments.length}/{shift.max_volunteers} volunteers
                  </Badge>
                </div>
                {shift.location && shift.location.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground font-normal mt-1">
                    <MapPin className="h-4 w-4" />
                    {shift.location.join(', ')}
                  </div>
                )}
                {shift.notes && (
                  <div className="text-sm text-muted-foreground font-normal mt-2">
                    {shift.notes}
                  </div>
                )}
              </DialogTitle>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (onEdit) {
                      onOpenChange(false)
                      onEdit(shift)
                    }
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (onDelete) {
                      onOpenChange(false)
                      onDelete(shift)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="interests" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="interests">
                Volunteer Pool
              </TabsTrigger>
              <TabsTrigger value="assigned" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assigned ({shift.assignments.length})
              </TabsTrigger>
              <TabsTrigger value="suggestions">
                Best Fit ({suggestions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="interests">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by name, email, or phone..."
                    value={interestsSearchQuery}
                    onChange={(e) => setInterestsSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <select 
                    className="px-3 py-2 border rounded-md"
                    value={interestsFilterType}
                    onChange={(e) => setInterestsFilterType(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="general">General Volunteers</option>
                    <option value="greeter">Greeters</option>
                    <option value="cleanup">Cleanup</option>
                    <option value="security">Security</option>
                    <option value="registration">Registration</option>
                    <option value="marathon">Marathon</option>
                    <option value="merch">Merch</option>
                    <option value="outreach">Outreach</option>
                    <option value="hospitality">Hospitality</option>
                    <option value="panel_chair">Panel Chairs</option>
                    <option value="panelist">Panelists</option>
                    <option value="host">Host Members</option>
                  </select>
                </div>
                
                <ScrollArea className="h-[400px] w-full">
                  <div className="space-y-2 pr-4">
                    {(() => {
                      // Filter volunteers based on search and type
                      let filteredVolunteers = allVolunteers.filter(v => {
                        // Already assigned volunteers should still show
                        const searchMatch = interestsSearchQuery ? (
                          v.name.toLowerCase().includes(interestsSearchQuery.toLowerCase()) ||
                          v.contact_info?.toLowerCase().includes(interestsSearchQuery.toLowerCase())
                        ) : true
                        
                        const typeMatch = interestsFilterType === "all" || 
                          (interestsFilterType === "general" && v.volunteer_type === "general") ||
                          (interestsFilterType === "greeter" && v.volunteer_type === "greeter") ||
                          (interestsFilterType === "cleanup" && v.volunteer_type === "cleanup") ||
                          (interestsFilterType === "security" && v.volunteer_type === "security") ||
                          (interestsFilterType === "registration" && v.volunteer_type === "registration") ||
                          (interestsFilterType === "marathon" && v.volunteer_type === "marathon") ||
                          (interestsFilterType === "merch" && v.volunteer_type === "merch") ||
                          (interestsFilterType === "outreach" && v.volunteer_type === "outreach") ||
                          (interestsFilterType === "hospitality" && (v.volunteer_type === "hospitality" || v.type === "hospitality")) ||
                          (interestsFilterType === "panel_chair" && v.type === "panel_chair") ||
                          (interestsFilterType === "panelist" && v.type === "panelist") ||
                          (interestsFilterType === "host" && v.type === "host")
                        
                        return searchMatch && typeMatch
                      })
                      
                      return filteredVolunteers.map((volunteer, idx) => (
                        <div 
                          key={`vol-interest-${volunteer.id}-${idx}`}
                          className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={getVolunteerBadgeColor(volunteer.type)}>
                                  {volunteer.volunteer_type || volunteer.type}
                                </Badge>
                                <span className="font-medium">{volunteer.name}</span>
                              </div>
                              
                              {/* Show contact info and metadata */}
                              <div className="text-sm text-muted-foreground space-y-0.5">
                                {volunteer.contact_info && (
                                  <div>{volunteer.contact_info}</div>
                                )}
                                
                                {/* Show additional metadata based on type */}
                                {volunteer.data && (
                                  <div className="text-xs">
                                    {volunteer.volunteer_type === 'greeter' && (
                                      <>
                                        {volunteer.data.day && <span>Day: {volunteer.data.day}</span>}
                                        {volunteer.data.day && (volunteer.data.time_slot || volunteer.data.time) && ' • '}
                                        {(volunteer.data.time_slot || volunteer.data.time) && (
                                          <span>Time: {volunteer.data.time_slot || volunteer.data.time}</span>
                                        )}
                                        {volunteer.data.room && (
                                          <>
                                            {(volunteer.data.day || volunteer.data.time_slot || volunteer.data.time) && ' • '}
                                            <span>Room: {volunteer.data.room}</span>
                                          </>
                                        )}
                                      </>
                                    )}
                                    {volunteer.volunteer_type === 'cleanup' && (
                                      <>
                                        {volunteer.data.date && <span>Date: {volunteer.data.date}</span>}
                                        {volunteer.data.date && volunteer.data.time && ' • '}
                                        {volunteer.data.time && <span>Time: {volunteer.data.time}</span>}
                                        {volunteer.data.location && (
                                          <>
                                            {(volunteer.data.date || volunteer.data.time) && ' • '}
                                            <span>Location: {volunteer.data.location}</span>
                                          </>
                                        )}
                                      </>
                                    )}
                                    {volunteer.type === 'panel_chair' && volunteer.data?.day_time && (
                                      <span>Panel: {volunteer.data.panel_name || 'TBD'} • {volunteer.data.day_time}</span>
                                    )}
                                    {volunteer.type === 'panelist' && volunteer.data?.time_day && (
                                      <span>Panel: {volunteer.data.title || 'TBD'} • {volunteer.data.time_day}</span>
                                    )}
                                    {volunteer.type === 'hospitality' && volunteer.data?.date_time && (
                                      <span>Hospitality: {volunteer.data.date_time}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <Button
                              size="sm"
                              onClick={() => handleAssignClick(volunteer)}
                              disabled={shift.assignments.length >= shift.max_volunteers}
                            >
                              Assign
                            </Button>
                          </div>
                        </div>
                      ))
                    })()}
                    
                    {allVolunteers.filter(v => {
                      const searchMatch = interestsSearchQuery ? (
                        v.name.toLowerCase().includes(interestsSearchQuery.toLowerCase()) ||
                        v.contact_info?.toLowerCase().includes(interestsSearchQuery.toLowerCase())
                      ) : true
                      
                      const typeMatch = interestsFilterType === "all" || 
                        (interestsFilterType === "general" && v.volunteer_type === "general") ||
                        (interestsFilterType === "greeter" && v.volunteer_type === "greeter") ||
                        (interestsFilterType === "cleanup" && v.volunteer_type === "cleanup") ||
                        (interestsFilterType === "security" && v.volunteer_type === "security") ||
                        (interestsFilterType === "registration" && v.volunteer_type === "registration") ||
                        (interestsFilterType === "marathon" && v.volunteer_type === "marathon") ||
                        (interestsFilterType === "merch" && v.volunteer_type === "merch") ||
                        (interestsFilterType === "outreach" && v.volunteer_type === "outreach") ||
                        (interestsFilterType === "hospitality" && (v.volunteer_type === "hospitality" || v.type === "hospitality")) ||
                        (interestsFilterType === "panel_chair" && v.type === "panel_chair") ||
                        (interestsFilterType === "panelist" && v.type === "panelist") ||
                        (interestsFilterType === "host" && v.type === "host")
                      
                      return searchMatch && typeMatch
                    }).length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No volunteers found matching filters
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="suggestions">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search volunteers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <select 
                    className="px-3 py-2 border rounded-md"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="host">Host Members</option>
                    <option value="volunteer">Volunteers</option>
                    <option value="hospitality">Hospitality</option>
                    <option value="panel_chair">Panel Chairs</option>
                    <option value="panelist">Panelists</option>
                  </select>
                </div>
                
                <ScrollArea className="h-[400px] w-full">
                  <div className="space-y-2 pr-4">
                    {suggestions.map((volunteer, volunteerIdx) => (
                      <div 
                        key={`volunteer-${volunteer.id}-${volunteerIdx}`}
                        className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={getVolunteerBadgeColor(volunteer.type)}>
                                {volunteer.type}
                              </Badge>
                              <span className="font-medium">{volunteer.name}</span>
                              {volunteer.score >= 20 && (
                                <Badge variant="secondary" className="gap-1">
                                  <Star className="h-3 w-3" />
                                  Best fit
                                </Badge>
                              )}
                            </div>
                            
                            {volunteer.contact_info && (
                              <p className="text-sm text-muted-foreground">{volunteer.contact_info}</p>
                            )}
                            
                            {/* Show volunteer metadata for greeter and cleanup */}
                            {volunteer.data && (volunteer.volunteer_type === 'greeter' || volunteer.volunteer_type === 'cleanup') && (
                              <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                                {volunteer.volunteer_type === 'greeter' && (
                                  <>
                                    {volunteer.data.day && <span>Day: {volunteer.data.day}</span>}
                                    {volunteer.data.day && (volunteer.data.time_slot || volunteer.data.time) && ' • '}
                                    {(volunteer.data.time_slot || volunteer.data.time) && (
                                      <span>Time: {volunteer.data.time_slot || volunteer.data.time}</span>
                                    )}
                                    {(volunteer.data.day || volunteer.data.time_slot || volunteer.data.time) && volunteer.data.room && ' • '}
                                    {volunteer.data.room && <span>Room: {volunteer.data.room}</span>}
                                  </>
                                )}
                                {volunteer.volunteer_type === 'cleanup' && (
                                  <>
                                    {volunteer.data.date && <span>Date: {volunteer.data.date}</span>}
                                    {volunteer.data.date && volunteer.data.time && ' • '}
                                    {volunteer.data.time && <span>Time: {volunteer.data.time}</span>}
                                    {(volunteer.data.date || volunteer.data.time) && volunteer.data.location && ' • '}
                                    {volunteer.data.location && <span>Loc: {volunteer.data.location}</span>}
                                  </>
                                )}
                              </div>
                            )}
                            
                            <div className="space-y-1">
                              {volunteer.reasons.map((reason, idx) => (
                                <div key={`reason-${volunteer.id}-${idx}`} className="flex items-center gap-1 text-xs">
                                  {reason.startsWith('✓') ? (
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                  ) : reason.startsWith('⚠') ? (
                                    <AlertTriangle className="h-3 w-3 text-orange-500" />
                                  ) : (
                                    <Info className="h-3 w-3 text-blue-500" />
                                  )}
                                  <span className={
                                    reason.startsWith('✓') ? "text-green-600" :
                                    reason.startsWith('⚠') ? "text-orange-500" :
                                    ""
                                  }>
                                    {reason.replace(/^[✓⚠]/, '').trim()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <Button
                            size="sm"
                            onClick={() => handleAssignClick(volunteer)}
                            disabled={shift.assignments.length >= shift.max_volunteers}
                          >
                            Assign
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    {suggestions.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No available volunteers found
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="assigned" className="space-y-2">
              {needsCoverage && (
                <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-950 rounded-md">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-600">
                    Need {shift.min_volunteers - shift.assignments.length} more volunteer(s)
                  </span>
                </div>
              )}
              
              {shift.assignments.length > 0 ? (
                <ScrollArea className="h-[400px] w-full">
                  <div className="space-y-2">
                    {shift.assignments.map((assignment, assignmentIdx) => (
                      <div key={`assignment-${assignment.id}-${assignmentIdx}`} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex items-center gap-2">
                          <Badge variant={getVolunteerBadgeColor(assignment.type)}>
                            {assignment.type}
                          </Badge>
                          <div>
                            <p className="font-medium">{assignment.name}</p>
                            {assignment.contact && (
                              <p className="text-sm text-muted-foreground">{assignment.contact}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemove(shift, assignment.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
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
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Conflict Confirmation Dialog */}
      <Dialog open={!!showConflictConfirm} onOpenChange={(open) => !open && setShowConflictConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Schedule Conflict Detected
            </DialogTitle>
          </DialogHeader>
          
          {showConflictConfirm && (
            <div className="space-y-4">
              <p>
                <strong>{showConflictConfirm.volunteer.name}</strong> has conflicting assignments:
              </p>
              
              <div className="space-y-2">
                {showConflictConfirm.conflicts.map((conflict, conflictIdx) => (
                  <div key={`conflict-${conflict.id}-${conflictIdx}`} className="p-3 border rounded-md bg-orange-50 dark:bg-orange-950">
                    <p className="font-medium">{conflict.job_type}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatTime12Hour(conflict.start_time)} - {formatTime12Hour(conflict.end_time)}
                      </span>
                      {conflict.location && (
                        <>
                          <span>•</span>
                          <span>{conflict.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">
                  Are you sure you want to create this overlapping assignment?
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowConflictConfirm(null)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => {
                    if (shift && showConflictConfirm) {
                      onAssign(shift, showConflictConfirm.volunteer)
                      setShowConflictConfirm(null)
                    }
                  }}
                >
                  Assign Anyway
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}