"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react"
import { parseGreeterSpreadsheet, type GreeterEntry } from "@/utils/xlsx-greeter-parser"
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

interface GreeterUploadProps {
  conferenceDates: string[]
  onUploadSuccess?: (entries: GreeterEntry[]) => Promise<void>
}

export default function GreeterUpload({ conferenceDates, onUploadSuccess }: GreeterUploadProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewData, setPreviewData] = useState<GreeterEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setIsProcessing(true)

    try {
      const entries = await parseGreeterSpreadsheet(selectedFile, conferenceDates)
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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-500">Accepted</Badge>
      case "declined":
        return <Badge variant="destructive">Declined</Badge>
      case "maybe":
        return <Badge variant="secondary">Maybe</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        variant="outline"
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload Greeter Spreadsheet
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Upload Greeter Spreadsheet
            </DialogTitle>
            <DialogDescription>
              Upload an Excel spreadsheet with greeter volunteer information.
              The spreadsheet should have columns for Day, Name, Meeting, Room, Time, Phone, Status, and Notes.
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
                        id="greeter-file-upload"
                        disabled={isProcessing}
                      />
                      <label htmlFor="greeter-file-upload">
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
                    Successfully parsed {previewData.length} greeter entries from {file?.name}
                  </AlertDescription>
                </Alert>

                <Card>
                  <CardHeader>
                    <CardTitle>Preview Data</CardTitle>
                    <CardDescription>
                      Review the parsed data before confirming the upload
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] w-full">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Day</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Meeting</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.map((entry, idx) => (
                            <TableRow key={`greeter-${idx}`}>
                              <TableCell>
                                {new Date(entry.day).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </TableCell>
                              <TableCell>
                                {entry.name} {entry.last_initial || ""}
                              </TableCell>
                              <TableCell>{entry.room}</TableCell>
                              <TableCell className="whitespace-nowrap">{entry.time}</TableCell>
                              <TableCell>{entry.meeting || "-"}</TableCell>
                              <TableCell>{entry.phone_number || "-"}</TableCell>
                              <TableCell>{getStatusBadge(entry.status)}</TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {entry.notes || "-"}
                              </TableCell>
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
                  <Button onClick={handleConfirmUpload}>
                    Confirm Upload ({previewData.length} entries)
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
