"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { sendTestNotification, getTestNotificationData } from "./actions"
import { Loader2, Send, CheckCircle2, XCircle, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type NotificationType = "panel-1day" | "panel-1hour" | "volunteer-12hour" | "chairperson" | "panel-initial"
type ContactMethod = "email" | "sms"

export default function TestNotificationsPage() {
  const [notificationType, setNotificationType] = useState<NotificationType>("panel-1day")
  const [contactMethod, setContactMethod] = useState<ContactMethod>("email")
  const [customMessage, setCustomMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)
  
  // Data from database
  const [panels, setPanels] = useState<any[]>([])
  const [shifts, setShifts] = useState<any[]>([])
  const [chairpeople, setChairpeople] = useState<any[]>([])
  
  // Selected items
  const [selectedPanelId, setSelectedPanelId] = useState<string>("")
  const [selectedShiftId, setSelectedShiftId] = useState<string>("")
  const [selectedChairpersonId, setSelectedChairpersonId] = useState<string>("")
  
  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getTestNotificationData()
      setPanels(data.panels)
      setShifts(data.shifts)
      setChairpeople(data.chairpeople)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    setSending(true)
    setResult(null)
    
    try {
      const response = await sendTestNotification({
        type: notificationType,
        method: contactMethod,
        customMessage: customMessage || undefined,
        panelId: (notificationType === "panel-initial" || notificationType === "panel-1day" || notificationType === "panel-1hour") && selectedPanelId ? parseInt(selectedPanelId) : undefined,
        shiftId: notificationType === "volunteer-12hour" && selectedShiftId ? selectedShiftId : undefined,
        chairpersonId: notificationType === "chairperson" && selectedChairpersonId ? parseInt(selectedChairpersonId) : undefined
      })
      
      setResult(response)
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to send test notification"
      })
    } finally {
      setSending(false)
    }
  }
  
  // Determine what data needs to be selected based on notification type
  const needsPanelSelection = notificationType === "panel-initial" || notificationType === "panel-1day" || notificationType === "panel-1hour"
  const needsShiftSelection = notificationType === "volunteer-12hour"
  const needsChairpersonSelection = notificationType === "chairperson"

  const notificationDescriptions: Record<NotificationType, string> = {
    "panel-initial": "Initial panel invitation with confirmation link",
    "panel-1day": "Reminder sent 24 hours before panel",
    "panel-1hour": "Reminder sent 1 hour before panel",
    "volunteer-12hour": "Reminder sent 12 hours before volunteer shift",
    "chairperson": "Chairperson notification with panel details and instructions"
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Test Notification System</CardTitle>
          <CardDescription>
            Send test notifications to verify templates and formatting. All tests will be sent to:
            <br />
            <strong>Email:</strong> josh@themindfulpug.com
            <br />
            <strong>SMS:</strong> 651-332-0330
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              ⚠️ These are TEST notifications only. They will always be sent to the test recipients above, regardless of the actual panel/volunteer data.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <Label htmlFor="notification-type">Notification Type</Label>
              <Select 
                value={notificationType} 
                onValueChange={(value) => setNotificationType(value as NotificationType)}
              >
                <SelectTrigger id="notification-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="panel-initial">Panel - Initial Invitation</SelectItem>
                  <SelectItem value="panel-1day">Panel - 1 Day Reminder</SelectItem>
                  <SelectItem value="panel-1hour">Panel - 1 Hour Reminder</SelectItem>
                  <SelectItem value="volunteer-12hour">Volunteer - 12 Hour Reminder</SelectItem>
                  <SelectItem value="chairperson">Chairperson Notification</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                {notificationDescriptions[notificationType]}
              </p>
            </div>

            <div>
              <Label htmlFor="contact-method">Delivery Method</Label>
              <Select 
                value={contactMethod} 
                onValueChange={(value) => setContactMethod(value as ContactMethod)}
              >
                <SelectTrigger id="contact-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {needsPanelSelection && (
              <div>
                <Label htmlFor="panel-select">Select Panel</Label>
                <Select 
                  value={selectedPanelId} 
                  onValueChange={setSelectedPanelId}
                  disabled={loading}
                >
                  <SelectTrigger id="panel-select">
                    <SelectValue placeholder="Choose a panel to test with" />
                  </SelectTrigger>
                  <SelectContent>
                    {panels.map((panel) => (
                      <SelectItem key={panel.id} value={panel.id.toString()}>
                        <div className="flex flex-col">
                          <span>{panel.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {panel.panelist_name} - {panel.time_day}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Uses real panel data but sends to test recipients only
                </p>
              </div>
            )}

            {needsShiftSelection && (
              <div>
                <Label htmlFor="shift-select">Select Shift with Assignments</Label>
                <Select 
                  value={selectedShiftId} 
                  onValueChange={setSelectedShiftId}
                  disabled={loading}
                >
                  <SelectTrigger id="shift-select">
                    <SelectValue placeholder="Choose a shift to test with" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        <div className="flex flex-col">
                          <span>{shift.job_type}</span>
                          <span className="text-xs text-muted-foreground">
                            {shift.date} {shift.start_time}-{shift.end_time} ({shift.assignments?.length || 0} assigned)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Uses real shift data but sends to test recipients only
                </p>
              </div>
            )}

            {needsChairpersonSelection && (
              <div>
                <Label htmlFor="chairperson-select">Select Chairperson</Label>
                <Select 
                  value={selectedChairpersonId} 
                  onValueChange={setSelectedChairpersonId}
                  disabled={loading}
                >
                  <SelectTrigger id="chairperson-select">
                    <SelectValue placeholder="Choose a chairperson to test with" />
                  </SelectTrigger>
                  <SelectContent>
                    {chairpeople.map((chair) => (
                      <SelectItem key={chair.id} value={chair.id.toString()}>
                        <div className="flex flex-col">
                          <span>{chair.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {chair.panel_name} - {chair.day_time}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1">
                  Uses real chairperson data but sends to test recipients only
                </p>
              </div>
            )}

            {notificationType === "chairperson" && (
              <div>
                <Label htmlFor="custom-message">Custom Message (Optional)</Label>
                <Textarea
                  id="custom-message"
                  placeholder="Leave blank to use default template"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  For chairperson notifications, you can override the default message
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={loadData}
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
            <Button 
              onClick={handleSendTest} 
              disabled={sending || loading || 
                (needsPanelSelection && !selectedPanelId) ||
                (needsShiftSelection && !selectedShiftId) ||
                (needsChairpersonSelection && !selectedChairpersonId)
              }
              className="flex-1"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Test...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Test Notification
                </>
              )}
            </Button>
          </div>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5" />
                )}
                <div className="flex-1">
                  <AlertDescription>{result.message}</AlertDescription>
                  {result.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        View Details
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto bg-muted p-2 rounded">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </Alert>
          )}

          <Tabs defaultValue="templates" className="mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates">Template Preview</TabsTrigger>
              <TabsTrigger value="info">Test Info</TabsTrigger>
            </TabsList>
            
            <TabsContent value="templates" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current Selection Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Sending a <strong>{notificationType}</strong> notification via <strong>{contactMethod}</strong>
                  </p>
                  <p className="text-sm mt-2">
                    This will use the actual template logic from the cron route, but with test data and recipients.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="info" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Database Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Total Panels:</span>
                    <Badge variant="secondary">{panels.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Confirmed Panels:</span>
                    <Badge variant="secondary">
                      {panels.filter(p => p.confirmed_at).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Shifts with Assignments:</span>
                    <Badge variant="secondary">{shifts.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Chairpeople:</span>
                    <Badge variant="secondary">{chairpeople.length}</Badge>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Test Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Alert>
                    <AlertDescription>
                      All notifications will use real data from your database but will ONLY be sent to:
                      <br />
                      <strong>Email:</strong> josh@themindfulpug.com
                      <br />
                      <strong>SMS:</strong> 651-332-0330
                    </AlertDescription>
                  </Alert>
                  <div className="text-muted-foreground">
                    <p>• Times and dates from the database are displayed exactly as stored (CST)</p>
                    <p>• The actual panel/volunteer names will be replaced with test recipient info</p>
                    <p>• All other data (times, rooms, descriptions) comes from your real database</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}