"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  parseXLSXChairpersonData,
  validateChairpersonData,
  type ParsedChairperson
} from "@/utils/xlsx-chairperson-parser"
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  FileSpreadsheet,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  User,
  X
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { deleteChairperson, getChairpeople, getPanels, saveChairpeople, updateChairperson } from "./actions"
import { 
  checkMessageStatuses, 
  getChairpeopleForNotification, 
  getNotificationHistory, 
  sendChairpersonNotifications,
  type ChairpersonNotification,
  type NotificationStatus 
} from "./notify-actions"

interface ChairpersonWithPanel extends Omit<ParsedChairperson, 'id'> {
  id: string | number
  panelId?: number
  matchConfidence?: number
  userId?: string
}

export default function ChairpeoplePage() {
  const [chairpeople, setChairpeople] = useState<ChairpersonWithPanel[]>([])
  const [parsedChairpeople, setParsedChairpeople] = useState<ParsedChairperson[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [panels, setPanels] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [editingData, setEditingData] = useState<any>({})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newChairperson, setNewChairperson] = useState({
    name: '',
    phone: '',
    dayTime: '',
    panelName: '',
    panelId: null as number | null
  })
  const [notificationChairpeople, setNotificationChairpeople] = useState<ChairpersonNotification[]>([])
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([])
  const [sendingNotifications, setSendingNotifications] = useState(false)
  const [notificationHistory, setNotificationHistory] = useState<any[]>([])
  const [notificationStatuses, setNotificationStatuses] = useState<NotificationStatus[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [chairpeopleData, panelsData] = await Promise.all([
        getChairpeople(),
        getPanels()
      ])
      // Map the data to the expected format
      const mappedChairpeople = (chairpeopleData || []).map(chair => ({
        ...chair,
        dayTime: chair.day_time,
        panelName: chair.panel_name,
        panelId: chair.panel_id,
        rawData: chair.raw_data || {}
      }))
      setChairpeople(mappedChairpeople)
      setPanels(panelsData || [])
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Failed to load chairpeople data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (chair: ChairpersonWithPanel) => {
    setEditingId(chair.id)
    setEditingData({
      name: chair.name,
      phone: chair.phone || '',
      dayTime: chair.dayTime,
      panelName: chair.panelName,
      panelId: chair.panelId
    })
  }

  const handleSaveEdit = async (id: string | number) => {
    try {
      // Find the selected panel details
      const selectedPanel = panels.find(p => p.id === editingData.panelId)
      
      await updateChairperson(Number(id), {
        name: editingData.name,
        phone: editingData.phone || null,
        day_time: editingData.dayTime,
        panel_name: selectedPanel?.title || editingData.panelName,
        panel_id: editingData.panelId || null
      })
      toast.success("Chairperson updated successfully")
      setEditingId(null)
      setEditingData({})
      loadData()
    } catch (error) {
      console.error("Error updating chairperson:", error)
      toast.error("Failed to update chairperson")
    }
  }

  const handleDelete = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this chairperson?")) return
    
    try {
      await deleteChairperson(Number(id))
      toast.success("Chairperson deleted successfully")
      loadData()
    } catch (error) {
      console.error("Error deleting chairperson:", error)
      toast.error("Failed to delete chairperson")
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingData({})
  }

  const handleAddSingleChairperson = async () => {
    try {
      // Validate required fields
      if (!newChairperson.name || !newChairperson.panelId) {
        toast.error("Please fill in all required fields")
        return
      }

      // Find the selected panel
      const selectedPanel = panels.find(p => p.id === newChairperson.panelId)
      if (!selectedPanel) {
        toast.error("Please select a valid panel")
        return
      }

      // Save the single chairperson with direct panel link
      await saveChairpeople([{
        id: `manual-${Date.now()}`,
        name: newChairperson.name.trim(),
        phone: newChairperson.phone?.trim(),
        dayTime: selectedPanel.time_day,
        panelName: selectedPanel.title,
        rawData: { panel_id: selectedPanel.id }
      }])

      toast.success("Chairperson added successfully")
      setShowAddDialog(false)
      setNewChairperson({
        name: '',
        phone: '',
        dayTime: '',
        panelName: '',
        panelId: null
      })
      loadData()
    } catch (error) {
      console.error("Error adding chairperson:", error)
      toast.error("Failed to add chairperson")
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please upload an Excel file (.xlsx or .xls)")
      return
    }

    setSelectedFile(file)
    setIsUploading(true)

    try {
      const result = await parseXLSXChairpersonData(file)
      
      if (result.errors.length > 0) {
        setParseErrors(result.errors)
      }

      if (result.chairpeople.length === 0) {
        toast.error("No valid chairperson data found in the file")
        setIsUploading(false)
        return
      }

      // Match chairpeople to panels using improved matching
      const chairpeopleWithMatches = result.chairpeople.map((chair) => {
        // Normalize panel name for matching
        const normalizeForMatch = (name: string) => {
          return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special chars except numbers
            .replace(/\s+/g, ' ')         // Normalize spaces
            .trim()
        }
        
        const chairPanelNormalized = normalizeForMatch(chair.panelName)
        
        // Find best matching panel
        let bestMatch = null
        let bestConfidence = 0
        
        for (const panel of panels) {
          const panelTitleNormalized = normalizeForMatch(panel.title)
          
          // Exact match (normalized)
          if (panelTitleNormalized === chairPanelNormalized) {
            bestMatch = panel
            bestConfidence = 100
            break
          }
          
          // Partial match
          const isPartialMatch = 
            (chairPanelNormalized.length >= 3 && panelTitleNormalized.includes(chairPanelNormalized)) ||
            (panelTitleNormalized.length >= 3 && chairPanelNormalized.includes(panelTitleNormalized))
          
          if (isPartialMatch && bestConfidence < 75) {
            bestMatch = panel
            bestConfidence = 75
          }
        }

        return {
          ...chair,
          panelId: bestMatch?.id,
          matchConfidence: bestConfidence
        }
      })

      setParsedChairpeople(chairpeopleWithMatches)
      setShowPreview(true)
      
      toast.success(
        `Parsed ${result.successfulRows} chairpeople from ${result.totalRows} rows`
      )
    } catch (error) {
      console.error("Error parsing file:", error)
      toast.error("Failed to parse Excel file")
    } finally {
      setIsUploading(false)
    }
  }

  const handleSaveChairpeople = async () => {
    try {
      setIsUploading(true)
      await saveChairpeople(parsedChairpeople)
      toast.success("Chairpeople saved successfully")
      setShowPreview(false)
      setParsedChairpeople([])
      setSelectedFile(null)
      loadData()
    } catch (error) {
      console.error("Error saving chairpeople:", error)
      toast.error("Failed to save chairpeople")
    } finally {
      setIsUploading(false)
    }
  }

  // Custom day sorting function
  const sortByDayTime = (a: any, b: any) => {
    const dayOrder = {
      'monday': 1, 'mon': 1,
      'tuesday': 2, 'tue': 2,
      'wednesday': 3, 'wed': 3,
      'thursday': 4, 'thu': 4, 'thurs': 4,
      'friday': 5, 'fri': 5,
      'saturday': 6, 'sat': 6,
      'sunday': 7, 'sun': 7
    }
    
    // Extract day from dayTime string
    const getDayValue = (dayTime: string) => {
      const lower = dayTime.toLowerCase()
      for (const [key, value] of Object.entries(dayOrder)) {
        if (lower.includes(key)) {
          return value
        }
      }
      return 999 // Put unrecognized days at the end
    }
    
    // Extract time from dayTime string
    const getTimeValue = (dayTime: string) => {
      const timeMatch = dayTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
      if (!timeMatch) return 0
      
      let hour = parseInt(timeMatch[1])
      const minute = parseInt(timeMatch[2] || '0')
      const isPM = timeMatch[3]?.toLowerCase() === 'pm'
      
      if (isPM && hour !== 12) hour += 12
      if (!isPM && hour === 12) hour = 0
      
      return hour * 60 + minute
    }
    
    const dayA = getDayValue(a.dayTime || a.day_time || '')
    const dayB = getDayValue(b.dayTime || b.day_time || '')
    
    if (dayA !== dayB) {
      return dayA - dayB
    }
    
    // If same day, sort by time
    const timeA = getTimeValue(a.dayTime || a.day_time || '')
    const timeB = getTimeValue(b.dayTime || b.day_time || '')
    
    return timeA - timeB
  }

  const filteredChairpeople = chairpeople
    .filter((chair) => {
      const matchesSearch =
        searchTerm === "" ||
        chair.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chair.panelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chair.dayTime.toLowerCase().includes(searchTerm.toLowerCase())

      return matchesSearch
    })
    .sort(sortByDayTime)

  const filteredParsedChairpeople = parsedChairpeople
    .filter((chair) => {
      const matchesSearch =
        searchTerm === "" ||
        chair.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chair.panelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chair.dayTime.toLowerCase().includes(searchTerm.toLowerCase())

      return matchesSearch
    })
    .sort(sortByDayTime)

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading chairpeople data...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Panel Chairpeople</h1>
          <p className="text-muted-foreground">
            Upload and manage panel chairpeople from Excel files
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Chairpeople Excel</CardTitle>
            <CardDescription>
              Upload an Excel file with columns: A (Name and Number), B (Day and Time),
              C (Panel Name)
            </CardDescription>
          </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isUploading}
                className="flex-1"
              />
              <Button disabled={!selectedFile || isUploading}>
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? "Processing..." : "Upload"}
              </Button>
            </div>

            {parseErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="font-medium">Parse Errors</span>
                </div>
                <ul className="text-sm space-y-1">
                  {parseErrors.slice(0, 5).map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                  {parseErrors.length > 5 && (
                    <li>... and {parseErrors.length - 5} more errors</li>
                  )}
                </ul>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">File Format Requirements:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Column A: Chairperson name and phone number</li>
                <li>• Column B: Day and time of the panel</li>
                <li>• Column C: Panel name</li>
                <li>• Phone numbers will be automatically extracted</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Single Chairperson Card */}
      <Card>
        <CardHeader>
          <CardTitle>Add Single Chairperson</CardTitle>
          <CardDescription>
            Manually add a chairperson to the database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Chairperson
          </Button>
        </CardContent>
      </Card>
    </div>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Chairpeople Import</DialogTitle>
            <DialogDescription>
              Review the parsed chairpeople before saving. {parsedChairpeople.length}{" "}
              chairpeople found.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chairpeople..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Day/Time</TableHead>
                    <TableHead>Panel</TableHead>
                    <TableHead>Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParsedChairpeople.map((chair, index) => {
                    const errors = validateChairpersonData(chair)
                    const hasErrors = errors.length > 0

                    return (
                      <TableRow key={index} className={hasErrors ? "bg-red-50" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {chair.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {chair.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {chair.phone}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No phone</span>
                          )}
                        </TableCell>
                        <TableCell>{chair.dayTime}</TableCell>
                        <TableCell>{chair.panelName}</TableCell>
                        <TableCell>
                          {(chair as ChairpersonWithPanel).panelId ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Matched
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <X className="h-3 w-3 mr-1" />
                              No Match
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveChairpeople} disabled={isUploading}>
                Save {parsedChairpeople.length} Chairpeople
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="current" className="w-full">
        <TabsList>
          <TabsTrigger value="current">Current Chairpeople</TabsTrigger>
          <TabsTrigger value="unmatched">Unmatched Panels</TabsTrigger>
          <TabsTrigger value="notify">Notify Chairpeople</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Chairpeople ({chairpeople.length})</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search chairpeople..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Day/Time</TableHead>
                    <TableHead>Panel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChairpeople.map((chair) => {
                    const isEditing = editingId === chair.id
                    
                    return (
                      <TableRow key={chair.id}>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editingData.name}
                              onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                              className="w-full"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {chair.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editingData.phone}
                              onChange={(e) => setEditingData({ ...editingData, phone: e.target.value })}
                              placeholder="Phone number"
                              className="w-full"
                            />
                          ) : (
                            chair.phone ? (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                {chair.phone}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No phone</span>
                            )
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={editingData.dayTime}
                              onChange={(e) => setEditingData({ ...editingData, dayTime: e.target.value })}
                              className="w-full"
                            />
                          ) : (
                            chair.dayTime
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between"
                                >
                                  {editingData.panelId
                                    ? panels.find(p => p.id === editingData.panelId)?.title || editingData.panelName
                                    : editingData.panelName || "Select panel..."}
                                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
                                <Command>
                                  <CommandInput placeholder="Search panels..." />
                                  <CommandEmpty>No panel found.</CommandEmpty>
                                  <ScrollArea className="h-[300px]">
                                    <CommandGroup>
                                      {panels.map((panel) => (
                                      <CommandItem
                                        key={panel.id}
                                        value={`${panel.title} ${panel.time_day} ${panel.room}`.toLowerCase()}
                                        onSelect={() => {
                                          setEditingData({
                                            ...editingData,
                                            panelId: panel.id,
                                            panelName: panel.title
                                          })
                                        }}
                                      >
                                        <div className="flex-1">
                                          <div className="font-medium">{panel.title}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {panel.time_day} {panel.room && `• ${panel.room}`}
                                          </div>
                                        </div>
                                        {editingData.panelId === panel.id && (
                                          <CheckCircle className="ml-2 h-4 w-4" />
                                        )}
                                      </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </ScrollArea>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : (
                            chair.panelName
                          )}
                        </TableCell>
                        <TableCell>
                          {chair.panelId ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Linked
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <X className="h-3 w-3 mr-1" />
                              Not Linked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSaveEdit(chair.id)}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(chair)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDelete(chair.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unmatched">
          <Card>
            <CardHeader>
              <CardTitle>Panels Without Chairpeople</CardTitle>
              <CardDescription>
                These panels do not have assigned chairpeople yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Panel Title</TableHead>
                    <TableHead>Day/Time</TableHead>
                    <TableHead>Room</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {panels
                    .filter(
                      (panel) =>
                        !chairpeople.some((chair) => chair.panelId === panel.id)
                    )
                    .map((panel) => (
                      <TableRow key={panel.id}>
                        <TableCell>{panel.title}</TableCell>
                        <TableCell>{panel.time_day}</TableCell>
                        <TableCell>{panel.room}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notify">
          <Card>
            <CardHeader>
              <CardTitle>Send Notifications to Chairpeople</CardTitle>
              <CardDescription>
                Send text messages to chairpeople with their panel information and instructions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Notification Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={async () => {
                      // Load chairpeople for notification
                      try {
                        const chairpeopleForNotify = await getChairpeopleForNotification()
                        setNotificationChairpeople(chairpeopleForNotify)
                        setSelectedNotifications(chairpeopleForNotify.map(c => c.chairpersonId))
                      } catch (error) {
                        toast.error("Failed to load chairpeople")
                      }
                    }}
                  >
                    Load Chairpeople
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedNotifications(
                        selectedNotifications.length === notificationChairpeople.length
                          ? []
                          : notificationChairpeople.map(c => c.chairpersonId)
                      )
                    }}
                  >
                    {selectedNotifications.length === notificationChairpeople.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                </div>
                <Button
                  disabled={selectedNotifications.length === 0 || sendingNotifications}
                  onClick={async () => {
                    if (confirm(`Send notifications to ${selectedNotifications.length} chairpeople?`)) {
                      setSendingNotifications(true)
                      try {
                        const results = await sendChairpersonNotifications(selectedNotifications)
                        setNotificationStatuses(results)
                        toast.success(`Sent ${results.filter(r => r.status === 'sent').length} messages`)
                        // Reload notification history
                        const history = await getNotificationHistory()
                        setNotificationHistory(history)
                      } catch (error) {
                        toast.error("Failed to send notifications")
                      } finally {
                        setSendingNotifications(false)
                      }
                    }
                  }}
                >
                  {sendingNotifications ? "Sending..." : `Send to ${selectedNotifications.length} Selected`}
                </Button>
              </div>

              {/* Chairpeople Selection Table */}
              {notificationChairpeople.length > 0 && (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={selectedNotifications.length === notificationChairpeople.length}
                            onChange={(e) => {
                              setSelectedNotifications(
                                e.target.checked
                                  ? notificationChairpeople.map(c => c.chairpersonId)
                                  : []
                              )
                            }}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Panel</TableHead>
                        <TableHead>Day/Time</TableHead>
                        <TableHead>Room</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notificationChairpeople.map((chair) => (
                        <TableRow key={chair.chairpersonId}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedNotifications.includes(chair.chairpersonId)}
                              onChange={(e) => {
                                setSelectedNotifications(
                                  e.target.checked
                                    ? [...selectedNotifications, chair.chairpersonId]
                                    : selectedNotifications.filter(id => id !== chair.chairpersonId)
                                )
                              }}
                            />
                          </TableCell>
                          <TableCell>{chair.chairpersonName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {chair.chairpersonPhone}
                            </div>
                          </TableCell>
                          <TableCell>{chair.panelTitle}</TableCell>
                          <TableCell>{chair.dayTime}</TableCell>
                          <TableCell>
                            {chair.room}
                            {chair.isHybrid && (
                              <Badge variant="secondary" className="ml-2">Hybrid</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Notification Status Table */}
              {notificationStatuses.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Notification Results</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Message ID</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notificationStatuses.map((status, index) => (
                          <TableRow key={index}>
                            <TableCell>{status.chairpersonName}</TableCell>
                            <TableCell>{status.phone}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  status.status === 'sent' || status.status === 'delivered'
                                    ? 'default'
                                    : status.status === 'failed' || status.status === 'undelivered'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {status.status}
                              </Badge>
                              {status.errorMessage && (
                                <p className="text-xs text-destructive mt-1">{status.errorMessage}</p>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {status.messageSid?.slice(0, 15)}...
                            </TableCell>
                            <TableCell>
                              {status.messageSid && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      const statuses = await checkMessageStatuses([status.messageSid!])
                                      setNotificationStatuses(prev =>
                                        prev.map((s, i) =>
                                          i === index ? statuses[0] : s
                                        )
                                      )
                                      toast.success("Status updated")
                                    } catch (error) {
                                      toast.error("Failed to check status")
                                    }
                                  }}
                                >
                                  Check Status
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Message Preview */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Message Preview</h3>
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm">
{`Hello [Name], thank you for serving as a chairperson at The 65th ICYPAA!

📅 Day & Time: [Day/Time]
📍 Room: [Room]
🎤 Panel Title: [Panel]
👥 Number of Panelists: [Count]

[If Orchestra C: Hybrid Panel notice]

Expectations:
• Arrive 15 minutes early to greet panelists and settle in.
• Each panelist will share for 10–15 minutes. Manage time fairly so all voices are heard.
• After the panelists' shares, please moderate an Ask It Basket session.
• Maintain a welcoming atmosphere and keep the focus on AA's primary purpose.
• Please dress appropriately as a trusted servant.

Thank you for your service!

In love and service,
The 65th ICYPAA Host Committee`}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      {/* Add Single Chairperson Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Chairperson</DialogTitle>
            <DialogDescription>
              Enter the details for the new chairperson
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newChairperson.name}
                onChange={(e) => setNewChairperson({...newChairperson, name: e.target.value})}
                placeholder="Enter chairperson name"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={newChairperson.phone}
                onChange={(e) => setNewChairperson({...newChairperson, phone: e.target.value})}
                placeholder="Enter phone number (optional)"
              />
            </div>
            <div>
              <Label htmlFor="panel">Panel *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="panel"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {newChairperson.panelId
                      ? panels.find(p => p.id === newChairperson.panelId)?.title
                      : "Select panel..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search panels..." />
                    <CommandEmpty>No panel found.</CommandEmpty>
                    <ScrollArea className="h-[300px]">
                      <CommandGroup>
                        {panels.map((panel) => (
                        <CommandItem
                          key={panel.id}
                          value={`${panel.title} ${panel.time_day} ${panel.room}`.toLowerCase()}
                          onSelect={() => {
                            setNewChairperson({
                              ...newChairperson,
                              panelId: panel.id,
                              panelName: panel.title,
                              dayTime: panel.time_day || newChairperson.dayTime
                            })
                          }}
                        >
                          <div className="flex-1">
                            <div className="font-medium">{panel.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {panel.time_day} {panel.room && `• ${panel.room}`}
                            </div>
                          </div>
                          {newChairperson.panelId === panel.id && (
                            <CheckCircle className="ml-2 h-4 w-4" />
                          )}
                        </CommandItem>
                        ))}
                      </CommandGroup>
                    </ScrollArea>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowAddDialog(false)
                setNewChairperson({
                  name: '',
                  phone: '',
                  dayTime: '',
                  panelName: '',
                  panelId: null
                })
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddSingleChairperson}>
                Add Chairperson
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}