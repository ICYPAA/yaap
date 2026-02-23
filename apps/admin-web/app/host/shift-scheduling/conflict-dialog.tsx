"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Clock } from "lucide-react"
import { format, differenceInMinutes } from "date-fns"

interface ConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflictDetails: any | null
  onConfirm: () => void
}

export default function ConflictDialog({
  open,
  onOpenChange,
  conflictDetails,
  onConfirm
}: ConflictDialogProps) {
  if (!conflictDetails) return null

  const { volunteer, conflicts } = conflictDetails

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Schedule Conflict Detected
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm">
            <strong>{volunteer.full_name || volunteer.volunteer_name}</strong> has conflicting assignments:
          </p>
          
          <div className="space-y-2">
            {conflicts.map((conflict: any) => {
              const overlapMinutes = differenceInMinutes(
                Math.min(new Date(conflict.end_time).getTime(), new Date(conflictDetails.shift?.end_time || Date.now()).getTime()),
                Math.max(new Date(conflict.start_time).getTime(), new Date(conflictDetails.shift?.start_time || Date.now()).getTime())
              )
              
              return (
                <div key={conflict.id} className="p-3 border rounded-md bg-orange-50 dark:bg-orange-950">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{conflict.name}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(conflict.start_time), "HH:mm")} - {format(new Date(conflict.end_time), "HH:mm")}
                        </span>
                      </div>
                      {conflict.location && (
                        <p className="text-sm text-muted-foreground">{conflict.location}</p>
                      )}
                    </div>
                    <div className="text-sm text-orange-600">
                      {overlapMinutes} min overlap
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          
          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm">
              Are you sure you want to create this overlapping assignment? The volunteer will be scheduled for multiple shifts at the same time.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Confirm Assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}