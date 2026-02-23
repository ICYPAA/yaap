"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  formatMeetingForDisplay,
  parseXLSXMeetingData,
  validateMeetingData,
  type ParsedMeeting,
  type ParsedMeetingData
} from "@/utils/xlsx-meeting-parser"
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  Repeat,
  Upload,
  User,
  Users
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface MeetingXLSXUploadProps {
  onMeetingsProcessed?: (meetings: ParsedMeeting[]) => void
  onError?: (error: string) => void
}

export function MeetingXLSXUpload({
  onMeetingsProcessed,
  onError
}: MeetingXLSXUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedMeetingData | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please upload an Excel file (.xlsx or .xls)")
      return
    }

    setSelectedFile(file)
    setParsedData(null)
  }

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first")
      return
    }

    setUploading(true)
    try {
      const result = await parseXLSXMeetingData(selectedFile)
      setParsedData(result)

      if (result.errors.length > 0) {
        toast.error(`Parsed with ${result.errors.length} errors`)
        onError?.(result.errors.join("; "))
      } else {
        toast.success(
          `Successfully parsed ${result.successfulRows} meetings from ${result.totalRows} rows`
        )
      }

      onMeetingsProcessed?.(result.meetings)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred"
      toast.error(`Failed to parse file: ${errorMessage}`)
      onError?.(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const getMeetingValidationErrors = (meeting: ParsedMeeting): string[] => {
    return validateMeetingData(meeting)
  }

  const hasValidationErrors = (meeting: ParsedMeeting): boolean => {
    return getMeetingValidationErrors(meeting).length > 0
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Meeting Spreadsheet
          </CardTitle>
          <CardDescription>
            Upload an Excel file (.xlsx) with meeting data. The first row should
            contain headers including Date, Day, and member information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Choose Excel file</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                disabled={uploading}
                className="mt-1"
              />
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  onClick={handleFileUpload}
                  disabled={uploading}
                  size="sm"
                >
                  {uploading ? "Processing..." : "Parse File"}
                </Button>
              </div>
            )}

            {uploading && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Processing file and parsing meeting data...
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {parsedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Parsed Meeting Data
            </CardTitle>
            <CardDescription>
              {parsedData.successfulRows} meetings parsed from{" "}
              {parsedData.totalRows} rows
              {parsedData.errors.length > 0 &&
                ` with ${parsedData.errors.length} errors`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-900">
                      {
                        parsedData.meetings.filter(
                          (m) => !hasValidationErrors(m)
                        ).length
                      }
                    </div>
                    <div className="text-sm text-green-700">Valid Meetings</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <Repeat className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium text-blue-900">
                      {parsedData.meetings.filter((m) => m.isRecurring).length}
                    </div>
                    <div className="text-sm text-blue-700">Recurring</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="font-medium text-purple-900">
                      {
                        parsedData.meetings.filter(
                          (m) => m.isMultipleDaysPerWeek
                        ).length
                      }
                    </div>
                    <div className="text-sm text-purple-700">Multi-Day</div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {parsedData.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">Parsing Errors:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {parsedData.errors.map((error, index) => (
                        <li key={index} className="text-sm">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="h-px bg-border my-4" />

              {/* Meeting List */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Meeting Details</h3>
                {parsedData.meetings.length === 0 ? (
                  <p className="text-muted-foreground">No meetings found</p>
                ) : (
                  <div className="space-y-4">
                    {parsedData.meetings.map((meeting, index) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        index={index}
                        validationErrors={getMeetingValidationErrors(meeting)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface MeetingCardProps {
  meeting: ParsedMeeting
  index: number
  validationErrors: string[]
}

function MeetingCard({ meeting, index, validationErrors }: MeetingCardProps) {
  const hasErrors = validationErrors.length > 0

  return (
    <Card className={hasErrors ? "border-red-200 bg-red-50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">
              {meeting.name || `Meeting ${index + 1}`}
              {hasErrors && (
                <AlertCircle className="inline h-4 w-4 text-red-500 ml-2" />
              )}
            </CardTitle>
            <CardDescription>
              {formatMeetingForDisplay(meeting)}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {meeting.isRecurring && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                <Repeat className="h-3 w-3" />
                Recurring
              </div>
            )}
            {meeting.isMultipleDaysPerWeek && (
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                <Calendar className="h-3 w-3" />
                Multi-Day
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Meeting Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {meeting.date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{meeting.date}</span>
              </div>
            )}
            {meeting.time && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{meeting.time}</span>
              </div>
            )}
            {meeting.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{meeting.location}</span>
              </div>
            )}
          </div>

          {/* Days of Week */}
          {meeting.daysOfWeek && meeting.daysOfWeek.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Days: {meeting.daysOfWeek.join(", ")}</span>
            </div>
          )}

          {/* Members */}
          {meeting.members.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Members ({meeting.members.length})
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meeting.members.map((member, memberIndex) => (
                    <TableRow key={memberIndex}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {member.name || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {member.phone || "—"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Validation Errors */}
          {hasErrors && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Validation Issues:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, errorIndex) => (
                    <li key={errorIndex} className="text-sm">
                      {error}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
