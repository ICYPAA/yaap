"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SMSLog {
  id: number
  created_at: string
  notification_id: number | null
  message_sid: string
  message_status: string
  error_code: string | null
  error_message: string | null
  to_number: string
  from_number: string | null
  reminder_type: string
  webhook_data: any
}

export default function SMSLogsPage() {
  const [logs, setLogs] = useState<SMSLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadLogs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sms_delivery_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error('Error loading SMS logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === 'delivered') {
      return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Delivered</Badge>
    } else if (statusLower === 'failed' || statusLower === 'undelivered') {
      return <Badge className="bg-red-600"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>
    } else if (statusLower === 'sent') {
      return <Badge className="bg-blue-600"><Clock className="w-3 h-3 mr-1" />Sent</Badge>
    } else {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />{status}</Badge>
    }
  }

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '-'
    // Format as (XXX) XXX-XXXX if it's a US number
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>SMS Delivery Logs</CardTitle>
          <Button onClick={loadLogs} size="sm" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No SMS logs found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Notification ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>To Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Message SID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{log.notification_id || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.reminder_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatPhoneNumber(log.to_number)}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.message_status)}</TableCell>
                      <TableCell>
                        {log.error_code && (
                          <div className="text-xs">
                            <div className="font-semibold text-red-600">
                              Error {log.error_code}
                            </div>
                            {log.error_message && (
                              <div className="text-muted-foreground">
                                {log.error_message}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.message_sid.slice(-8)}...
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}