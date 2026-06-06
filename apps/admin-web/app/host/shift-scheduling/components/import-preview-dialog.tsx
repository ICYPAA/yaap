"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, CheckCircle, Plus, Edit, Trash, Upload } from "lucide-react"
import { ImportPreview } from "../schedule-utils"

interface ImportPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: ImportPreview | null
  onConfirm: () => void
  onCancel: () => void
}

export default function ImportPreviewDialog({
  open,
  onOpenChange,
  preview,
  onConfirm,
  onCancel
}: ImportPreviewDialogProps) {
  if (!preview) return null

  const hasChanges = preview.newShifts.length > 0 || 
                     preview.updatedShifts.length > 0 || 
                     preview.deletedShifts.length > 0

  const hasErrors = preview.errors.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Preview
          </DialogTitle>
          <DialogDescription>
            Review the changes that will be made to your shift schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasErrors && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Import Errors:</div>
                <ul className="list-disc list-inside text-sm">
                  {preview.errors.slice(0, 5).map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                  {preview.errors.length > 5 && (
                    <li>...and {preview.errors.length - 5} more errors</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {!hasChanges && !hasErrors && (
            <Alert>
              <AlertDescription>
                No changes detected in the imported file.
              </AlertDescription>
            </Alert>
          )}

          {hasChanges && (
            <Tabs defaultValue="new" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="new" className="flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  New ({preview.newShifts.length})
                </TabsTrigger>
                <TabsTrigger value="updated" className="flex items-center gap-1">
                  <Edit className="h-3 w-3" />
                  Updated ({preview.updatedShifts.length})
                </TabsTrigger>
                <TabsTrigger value="deleted" className="flex items-center gap-1">
                  <Trash className="h-3 w-3" />
                  Deleted ({preview.deletedShifts.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="new">
                <ScrollArea className="h-[300px] w-full border rounded-md p-4">
                  {preview.newShifts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No new shifts to add</p>
                  ) : (
                    <div className="space-y-2">
                      {preview.newShifts.map((shift, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950 rounded-md">
                          <div className="flex-1">
                            <p className="font-medium">{shift.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {shift.job_type}
                              </Badge>
                              <span>{shift.date}</span>
                              <span>{shift.start_time?.split(' ')[1]} - {shift.end_time?.split(' ')[1]}</span>
                              {shift.location && <span>• {shift.location}</span>}
                            </div>
                          </div>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="updated">
                <ScrollArea className="h-[300px] w-full border rounded-md p-4">
                  {preview.updatedShifts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No shifts to update</p>
                  ) : (
                    <div className="space-y-2">
                      {preview.updatedShifts.map((shift, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-950 rounded-md">
                          <div className="flex-1">
                            <p className="font-medium">{shift.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {shift.job_type}
                              </Badge>
                              <span>{shift.date}</span>
                              <span>{shift.start_time?.split(' ')[1]} - {shift.end_time?.split(' ')[1]}</span>
                            </div>
                          </div>
                          <Edit className="h-4 w-4 text-blue-600" />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="deleted">
                <ScrollArea className="h-[300px] w-full border rounded-md p-4">
                  {preview.deletedShifts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No shifts to delete</p>
                  ) : (
                    <div className="space-y-2">
                      {preview.deletedShifts.map((shift, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950 rounded-md">
                          <div className="flex-1">
                            <p className="font-medium">{shift.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {shift.job_type}
                              </Badge>
                              <span>{shift.date}</span>
                              <span>{shift.start_time?.split(' ')[1]} - {shift.end_time?.split(' ')[1]}</span>
                            </div>
                          </div>
                          <Trash className="h-4 w-4 text-red-600" />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Plus className="h-3 w-3 text-green-600" />
                {preview.newShifts.length} new
              </span>
              <span className="flex items-center gap-1">
                <Edit className="h-3 w-3 text-blue-600" />
                {preview.updatedShifts.length} updated
              </span>
              <span className="flex items-center gap-1">
                <Trash className="h-3 w-3 text-red-600" />
                {preview.deletedShifts.length} deleted
              </span>
            </div>
            {hasErrors && (
              <span className="text-red-600">
                {preview.errors.length} error{preview.errors.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={!hasChanges || hasErrors}
          >
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
