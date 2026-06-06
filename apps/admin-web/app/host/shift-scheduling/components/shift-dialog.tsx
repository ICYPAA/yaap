"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Shift, JOB_TYPES, type ConferenceDateRange } from "../types"
import { X } from "lucide-react"

interface ShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift?: Shift | null
  onSave: (shift: Partial<Shift>) => void
  onDelete?: (shiftId: string) => void
  venueRooms: string[]
  conferenceDates: ConferenceDateRange
}

export default function ShiftDialog({
  open,
  onOpenChange,
  shift,
  onSave,
  onDelete,
  venueRooms,
  conferenceDates
}: ShiftDialogProps) {
  const defaultDate = conferenceDates.start || new Date().toISOString().slice(0, 10)
  const [formData, setFormData] = useState({
    date: defaultDate,
    start_time: "09:00",
    end_time: "11:00",
    job_type: JOB_TYPES[0].name,
    location: [] as string[],
    min_volunteers: 1,
    max_volunteers: 2,
    notes: ""
  })
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)

  useEffect(() => {
    if (shift) {
      setFormData({
        date: shift.date,
        start_time: shift.start_time.slice(0, 5),
        end_time: shift.end_time.slice(0, 5),
        job_type: shift.job_type,
        location: shift.location || [],
        min_volunteers: shift.min_volunteers,
        max_volunteers: shift.max_volunteers,
        notes: shift.notes || ""
      })
    } else {
      setFormData({
        date: defaultDate,
        start_time: "09:00",
        end_time: "11:00",
        job_type: JOB_TYPES[0].name,
        location: [],
        min_volunteers: 1,
        max_volunteers: 2,
        notes: ""
      })
    }
  }, [shift, defaultDate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      id: shift?.id || 'new',
      ...formData,
      location: formData.location.length > 0 ? formData.location : undefined,
      start_time: formData.start_time + ":00",
      end_time: formData.end_time + ":00",
      assignments: shift?.assignments || []
    })
  }

  const toggleLocation = (room: string) => {
    setFormData(prev => ({
      ...prev,
      location: prev.location.includes(room)
        ? prev.location.filter(r => r !== room)
        : [...prev.location, room]
    }))
  }

  const removeLocation = (room: string) => {
    setFormData(prev => ({
      ...prev,
      location: prev.location.filter(r => r !== room)
    }))
  }

  const handleDelete = () => {
    if (shift?.id && onDelete) {
      if (confirm("Are you sure you want to delete this shift?")) {
        onDelete(shift.id)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{shift ? "Edit Shift" : "Create New Shift"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              min={conferenceDates.start || undefined}
              max={conferenceDates.end || undefined}
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="job_type">Job Type</Label>
            <Select 
              value={formData.job_type} 
              onValueChange={(value) => setFormData({ ...formData, job_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                {JOB_TYPES.map(jt => (
                  <SelectItem key={jt.name} value={jt.name}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: jt.color }}
                      />
                      {jt.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="location">Location(s)</Label>
            <div className="space-y-2">
              {/* Selected locations */}
              {formData.location.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.location.map(room => (
                    <div key={room} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm">
                      <span>{room}</span>
                      <button
                        type="button"
                        onClick={() => removeLocation(room)}
                        className="hover:bg-blue-200 rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Dropdown button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className="w-full justify-start"
              >
                {formData.location.length === 0 ? "Select locations..." : "Add more locations..."}
              </Button>
              
              {/* Location options */}
              {showLocationDropdown && (
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                  {venueRooms.map(room => (
                    <label
                      key={room}
                      className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={formData.location.includes(room)}
                        onCheckedChange={() => toggleLocation(room)}
                      />
                      <span className="text-sm">{room}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min_volunteers">Minimum Volunteers</Label>
              <Input
                id="min_volunteers"
                type="number"
                min="1"
                value={formData.min_volunteers}
                onChange={(e) => setFormData({ ...formData, min_volunteers: parseInt(e.target.value) })}
                required
              />
            </div>
            <div>
              <Label htmlFor="max_volunteers">Maximum Volunteers</Label>
              <Input
                id="max_volunteers"
                type="number"
                min="1"
                value={formData.max_volunteers}
                onChange={(e) => setFormData({ ...formData, max_volunteers: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any special instructions or requirements..."
              rows={3}
            />
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {shift?.id && onDelete && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  Delete Shift
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {shift ? "Update" : "Create"} Shift
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
