"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"

interface JobType {
  id: string
  name: string
  color: string
}

interface ShiftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift?: any | null
  jobTypes: JobType[]
  onSave: (shift: any) => void
}

export default function ShiftDialog({
  open,
  onOpenChange,
  shift,
  jobTypes,
  onSave
}: ShiftDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    job_type_id: "",
    location: "",
    start_time: "",
    end_time: "",
    min_volunteers: 1,
    max_volunteers: 1,
    notes: ""
  })

  useEffect(() => {
    if (shift) {
      setFormData({
        name: shift.name,
        job_type_id: shift.job_type_id,
        location: shift.location || "",
        start_time: format(new Date(shift.start_time), "yyyy-MM-dd'T'HH:mm"),
        end_time: format(new Date(shift.end_time), "yyyy-MM-dd'T'HH:mm"),
        min_volunteers: shift.min_volunteers,
        max_volunteers: shift.max_volunteers,
        notes: shift.notes || ""
      })
    } else {
      setFormData({
        name: "",
        job_type_id: jobTypes[0]?.id || "",
        location: "",
        start_time: "",
        end_time: "",
        min_volunteers: 1,
        max_volunteers: 1,
        notes: ""
      })
    }
  }, [shift, jobTypes])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...formData,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{shift ? "Edit Shift" : "Create New Shift"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Shift Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Morning Registration"
              required
            />
          </div>

          <div>
            <Label htmlFor="job_type">Job Type</Label>
            <Select 
              value={formData.job_type_id} 
              onValueChange={(value) => setFormData({ ...formData, job_type_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job type" />
              </SelectTrigger>
              <SelectContent>
                {jobTypes.map(jt => (
                  <SelectItem key={jt.id} value={jt.id}>
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
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Main Lobby"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
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
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any special instructions or requirements..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {shift ? "Update" : "Create"} Shift
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}