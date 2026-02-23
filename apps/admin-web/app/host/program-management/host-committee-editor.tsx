"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusIcon, TrashIcon, EditIcon, UsersIcon } from "lucide-react"
import { updateProgram } from "./actions"
import { toast } from "sonner"

interface CommitteeMember {
  name: string
  role: string
}

interface HostCommitteeData {
  [committeeName: string]: CommitteeMember[]
}

interface HostCommitteeEditorProps {
  programId: number
  initialData?: HostCommitteeData
}

export function HostCommitteeEditor({ programId, initialData }: HostCommitteeEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [committees, setCommittees] = useState<HostCommitteeData>(initialData || {})
  const [newCommitteeName, setNewCommitteeName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const addCommittee = () => {
    if (newCommitteeName && !committees[newCommitteeName]) {
      setCommittees({
        ...committees,
        [newCommitteeName]: []
      })
      setNewCommitteeName("")
    }
  }

  const removeCommittee = (committeeName: string) => {
    const updatedCommittees = { ...committees }
    delete updatedCommittees[committeeName]
    setCommittees(updatedCommittees)
  }

  const addMember = (committeeName: string) => {
    setCommittees({
      ...committees,
      [committeeName]: [...committees[committeeName], { name: "", role: "" }]
    })
  }

  const updateMember = (committeeName: string, memberIndex: number, field: "name" | "role", value: string) => {
    const updatedCommittees = { ...committees }
    updatedCommittees[committeeName][memberIndex][field] = value
    setCommittees(updatedCommittees)
  }

  const removeMember = (committeeName: string, memberIndex: number) => {
    const updatedCommittees = { ...committees }
    updatedCommittees[committeeName].splice(memberIndex, 1)
    setCommittees(updatedCommittees)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Filter out empty members
      const cleanedCommittees: HostCommitteeData = {}
      Object.entries(committees).forEach(([committeeName, members]) => {
        const validMembers = members.filter(member => member.name && member.role)
        if (validMembers.length > 0) {
          cleanedCommittees[committeeName] = validMembers
        }
      })

      const result = await updateProgram(programId, { host_committee: cleanedCommittees })
      if (result.error) {
        toast.error("Failed to update host committee")
      } else {
        toast.success("Host committee updated successfully")
        setIsOpen(false)
      }
    } catch (error) {
      toast.error("An error occurred while saving")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <EditIcon className="h-4 w-4 mr-2" />
          Edit Host Committee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Host Committee</DialogTitle>
          <DialogDescription>
            Manage committee groups and their members
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Add new committee */}
          <div className="flex gap-2">
            <Input
              placeholder="New committee name (e.g., Steering Committee)"
              value={newCommitteeName}
              onChange={(e) => setNewCommitteeName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addCommittee()}
            />
            <Button onClick={addCommittee} disabled={!newCommitteeName}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Committee
            </Button>
          </div>

          {/* List of committees */}
          <div className="space-y-4">
            {Object.entries(committees).map(([committeeName, members]) => (
              <Card key={committeeName}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <UsersIcon className="h-5 w-5" />
                      {committeeName}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCommittee(committeeName)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {members.map((member, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          placeholder="Member name"
                          value={member.name}
                          onChange={(e) => updateMember(committeeName, index, "name", e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Role</Label>
                        <Input
                          placeholder="Role/Position"
                          value={member.role}
                          onChange={(e) => updateMember(committeeName, index, "role", e.target.value)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(committeeName, index)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addMember(committeeName)}
                    className="w-full"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}