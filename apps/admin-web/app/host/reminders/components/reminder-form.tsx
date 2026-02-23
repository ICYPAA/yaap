"use client"

import { Button } from "@/components/ui/button"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Check } from "lucide-react"
import { useEffect, useState } from "react"
import { useFormStatus } from "react-dom"

type ReminderFormProps = {
  type: string
  title: string
  defaultValues?: {
    time?: string
    place?: string
    message?: string
    reports_due?: string
  }
  action: (formData: FormData) => Promise<void>
}

export function ReminderForm({
  type,
  title,
  defaultValues,
  action
}: ReminderFormProps) {
  const [isDirty, setIsDirty] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [reportsDue, setReportsDue] = useState(
    defaultValues?.reports_due || "not_required"
  )

  // Reset success state when form becomes dirty
  useEffect(() => {
    if (isDirty) {
      setShowSuccess(false)
    }
  }, [isDirty])

  async function clientAction(formData: FormData) {
    formData.append("reports_due", reportsDue)
    await action(formData)
    setIsDirty(false)
    setShowSuccess(true)
  }

  return (
    <form action={clientAction}>
      <input type="hidden" name="type" value={type} />
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor={`time-${type}`}>Time</Label>
          <Input
            id={`time-${type}`}
            name="time"
            type="time"
            required
            defaultValue={defaultValues?.time}
            onChange={() => setIsDirty(true)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`place-${type}`}>Place</Label>
          <Input
            id={`place-${type}`}
            name="place"
            placeholder="Enter location..."
            required
            defaultValue={defaultValues?.place}
            onChange={() => setIsDirty(true)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`reports-due-${type}`}>Reports Due</Label>
          <Select
            value={reportsDue}
            onValueChange={(value) => {
              setReportsDue(value)
              setIsDirty(true)
            }}
          >
            <SelectTrigger id={`reports-due-${type}`}>
              <SelectValue placeholder="Select when reports are due" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_required">Not Required</SelectItem>
              <SelectItem value="monday">Monday</SelectItem>
              <SelectItem value="tuesday">Tuesday</SelectItem>
              <SelectItem value="wednesday">Wednesday</SelectItem>
              <SelectItem value="thursday">Thursday</SelectItem>
              <SelectItem value="friday">Friday</SelectItem>
              <SelectItem value="saturday">Saturday</SelectItem>
              <SelectItem value="sunday">Sunday</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`message-${type}`}>Message</Label>
          <Textarea
            id={`message-${type}`}
            name="message"
            placeholder="Enter reminder message..."
            required
            defaultValue={defaultValues?.message}
            onChange={() => setIsDirty(true)}
          />
        </div>
        <SubmitButton showSuccess={showSuccess} isDirty={isDirty} />
      </CardContent>
    </form>
  )
}

function SubmitButton({
  showSuccess,
  isDirty
}: {
  showSuccess: boolean
  isDirty: boolean
}) {
  const { pending } = useFormStatus()

  if (showSuccess && !isDirty) {
    return (
      <Button type="button" className="mt-2" variant="outline" disabled>
        <Check className="mr-2 h-4 w-4" />
        Saved
      </Button>
    )
  }

  if (!isDirty) {
    return (
      <Button type="button" className="mt-2" variant="outline" disabled>
        No Changes
      </Button>
    )
  }

  return (
    <Button type="submit" className="mt-2" disabled={pending}>
      {pending ? "Saving..." : "Save Changes"}
    </Button>
  )
}
