"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react"
import { parseCleanupSpreadsheet, type CleanupEntry } from "@/utils/xlsx-cleanup-parser"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"

interface CleanupUploadProps {
  onUploadSuccess?: (entries: CleanupEntry[]) => Promise<void>
}

export default function CleanupUpload({ onUploadSuccess }: CleanupUploadProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewData, setPreviewData] = useState<CleanupEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setIsProcessing(true)

    try {
      const entries = await parseCleanupSpreadsheet(selectedFile)
      setPreviewData(entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse spreadsheet")
      setPreviewData([])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleConfirmUpload = async () => {
    if (onUploadSuccess) {
      setIsProcessing(true)
      try {
        await onUploadSuccess(previewData)
      } finally {
        setIsProcessing(false)
      }
    }
    handleClose()
  }

  const handleClose = () => {
    setIsDialogOpen(false)
    setPreviewData([])
    setError(null)
    setFile(null)
  }

  // Group entries by person for summary
  const getEntrySummary = () => {
    const personMap = new Map<string, CleanupEntry[]>()
    previewData.forEach(entry => {
      const key = `${entry.name} ${entry.last_initial}`
      if (!personMap.has(key)) {
        personMap.set(key, [])
      }
      personMap.get(key)!.push(entry)
    })
    return personMap
  }

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        variant="outline"
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload Cleanup Spreadsheet
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload Cleanup Spreadsheet
            </DialogTitle>
            <DialogDescription>
              Upload an Excel spreadsheet with cleanup volunteer information.
              Format: A=Name, B=Location, C=Date/Time (e.g., "Thur-Sat 6pm-6:45pm"), D=Phone
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!previewData.length && !error && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <FileSpreadsheet className="h-16 w-16 text-muted-foreground/30" />
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Select an Excel file (.xlsx) to upload
                      </p>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        className="hidden"
                        id="cleanup-file-upload"
                        disabled={isProcessing}
                      />
                      <label htmlFor="cleanup-file-upload">
                        <Button variant="secondary" disabled={isProcessing} asChild>
                          <span>{isProcessing ? "Processing..." : "Choose File"}</span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {previewData.length > 0 && (
              <>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Successfully parsed {previewData.length} cleanup entries from {getEntrySummary().size} volunteers
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle>Preview Data</CardTitle>
                    <CardDescription>
                      Review the parsed data before confirming the upload
                      {getEntrySummary().size !== previewData.length && (
                        <span className="ml-2 text-xs">
                          (Multi-day entries have been split into individual records)
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] w-full">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Phone</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.map((entry, idx) => (
                            <TableRow key={`cleanup-${idx}`}>
                              <TableCell>
                                {entry.name} {entry.last_initial}
                              </TableCell>
                              <TableCell>{entry.location}</TableCell>
                              <TableCell>
                                {new Date(entry.date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{entry.time}</TableCell>
                              <TableCell>{entry.phone || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmUpload} disabled={isProcessing}>
                    {isProcessing ? "Processing..." : `Confirm Upload (${previewData.length} entries)`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}