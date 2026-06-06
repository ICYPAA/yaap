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
  SelectValue
} from "@/components/ui/select"
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
  AlertCircle,
  CheckCircle,
  Link as LinkIcon,
  Mail,
  Phone,
  Search,
  Unlink,
  User,
  X
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  checkAccountLinkingPermission,
  getUnlinkedRecords,
  getUsersWithLinkedAccounts,
  linkChairpersonToUser,
  unlinkChairpersonFromUser,
  updateUserPhone,
  type Chairperson,
  type LinkedAccount,
  type Volunteer
} from "./actions"

export default function AccountLinkingPage() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [unlinkedChairpeople, setUnlinkedChairpeople] = useState<Chairperson[]>([])
  const [unlinkedVolunteers, setUnlinkedVolunteers] = useState<Volunteer[]>([])
  const [allChairpeople, setAllChairpeople] = useState<Chairperson[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTab, setSelectedTab] = useState("linked")
  const [linkingChairperson, setLinkingChairperson] = useState<Chairperson | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [editingPhone, setEditingPhone] = useState<{ userId: string; phone: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      // Load linked accounts
      const linkedResult = await getUsersWithLinkedAccounts()
      if (linkedResult.error) {
        toast.error(linkedResult.error)
        return
      }
      
      setLinkedAccounts(linkedResult.users || [])
      setAllChairpeople(linkedResult.chairpeople || [])

      // Load unlinked records
      const unlinkedResult = await getUnlinkedRecords()
      if (unlinkedResult.error) {
        toast.error(unlinkedResult.error)
        return
      }
      
      setUnlinkedChairpeople(unlinkedResult.unlinkedChairpeople || [])
      setUnlinkedVolunteers(unlinkedResult.unlinkedVolunteers || [])
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("Failed to load account data")
    }
  }, [])

  const checkPermissionAndLoadData = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Check permissions
      const hasAccess = await checkAccountLinkingPermission()
      setHasPermission(hasAccess)
      
      if (!hasAccess) {
        toast.error("You don't have permission to access this page")
        return
      }

      await loadData()
    } catch (error) {
      console.error("Error checking permissions:", error)
      toast.error("Failed to check permissions")
      setHasPermission(false)
    } finally {
      setIsLoading(false)
    }
  }, [loadData])

  useEffect(() => {
    checkPermissionAndLoadData()
  }, [checkPermissionAndLoadData])

  const handleLinkChairperson = async () => {
    if (!linkingChairperson || !selectedUserId) {
      toast.error("Please select a user account")
      return
    }

    try {
      const result = await linkChairpersonToUser(linkingChairperson.id, selectedUserId)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Chairperson linked successfully")
      setLinkingChairperson(null)
      setSelectedUserId("")
      await loadData()
    } catch (error) {
      console.error("Error linking chairperson:", error)
      toast.error("Failed to link chairperson")
    }
  }

  const handleUnlinkChairperson = async (chairpersonId: number, userId: string) => {
    if (!confirm("Are you sure you want to unlink this chairperson from their account?")) {
      return
    }

    try {
      const result = await unlinkChairpersonFromUser(chairpersonId, userId)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Chairperson unlinked successfully")
      await loadData()
    } catch (error) {
      console.error("Error unlinking chairperson:", error)
      toast.error("Failed to unlink chairperson")
    }
  }

  const handleUpdatePhone = async (userId: string) => {
    if (!editingPhone) return

    try {
      const result = await updateUserPhone(userId, editingPhone.phone || null)
      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Phone number updated successfully")
      setEditingPhone(null)
      await loadData()
    } catch (error) {
      console.error("Error updating phone:", error)
      toast.error("Failed to update phone number")
    }
  }


  const filteredLinkedAccounts = linkedAccounts.filter((account) => {
    const matchesSearch =
      searchTerm === "" ||
      account.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.phone?.includes(searchTerm) ||
      account.profile_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.volunteer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.chairperson_name?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  const filteredUnlinkedChairpeople = unlinkedChairpeople.filter((chair) => {
    const matchesSearch =
      searchTerm === "" ||
      chair.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chair.phone?.includes(searchTerm)

    return matchesSearch
  })

  const filteredUnlinkedVolunteers = unlinkedVolunteers.filter((volunteer) => {
    const matchesSearch =
      searchTerm === "" ||
      volunteer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      volunteer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      volunteer.phone?.includes(searchTerm)

    return matchesSearch
  })

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading account linking data...</div>
      </div>
    )
  }

  if (hasPermission === false) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don&apos;t have permission to access account linking. This feature is only available to administrators and steering committee members.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Account Linking</h1>
          <p className="text-muted-foreground">
            Link user accounts to volunteers and chairpeople for authentication and access control
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Search</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="linked">
            Linked Accounts ({linkedAccounts.length})
          </TabsTrigger>
          <TabsTrigger value="unlinked-chairpeople">
            Unlinked Chairpeople ({unlinkedChairpeople.length})
          </TabsTrigger>
          <TabsTrigger value="unlinked-volunteers">
            Unlinked Volunteers ({unlinkedVolunteers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="linked">
          <Card>
            <CardHeader>
              <CardTitle>Linked User Accounts</CardTitle>
              <CardDescription>
                User accounts that are linked to volunteers or chairpeople
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Account</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Linked Volunteer</TableHead>
                    <TableHead>Linked Chairperson</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLinkedAccounts.map((account) => {
                    const isEditingPhone = editingPhone?.userId === account.id
                    // Check if this account is linked to a chairperson by phone match
                    const linkedChair = account.linked_chairperson_id ? 
                      allChairpeople.find(c => c.id === account.linked_chairperson_id) : 
                      null
                    
                    return (
                      <TableRow key={account.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {account.discord_server_name || account.profile_name || "No name"}
                              </div>
                              {account.discord_name && account.discord_name !== account.discord_server_name && (
                                <div className="text-xs text-muted-foreground">
                                  Discord: {account.discord_name}
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                ID: {account.id.slice(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {account.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3" />
                                {account.email}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {isEditingPhone ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={editingPhone.phone}
                                    onChange={(e) =>
                                      setEditingPhone({
                                        ...editingPhone,
                                        phone: e.target.value
                                      })
                                    }
                                    placeholder="Phone number"
                                    className="h-7 w-32"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleUpdatePhone(account.id)}
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setEditingPhone(null)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    setEditingPhone({
                                      userId: account.id,
                                      phone: account.phone || ""
                                    })
                                  }
                                  className="hover:underline"
                                >
                                  {account.phone || "Add phone"}
                                </button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {account.volunteer_name ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {account.volunteer_name}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <X className="h-3 w-3 mr-1" />
                              Not linked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {linkedChair ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-blue-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                {linkedChair.name}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnlinkChairperson(linkedChair.id, account.id)}
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Badge variant="outline">
                              <X className="h-3 w-3 mr-1" />
                              Not linked
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!linkedChair && unlinkedChairpeople.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUserId(account.id)
                                // Find best matching chairperson
                                const matchingChair = unlinkedChairpeople.find(c => {
                                  // Normalize phone numbers for comparison
                                  const normalizePhone = (phone: string) => {
                                    let normalized = phone.replace(/\D/g, "")
                                    if (normalized.length === 11 && normalized.startsWith("1")) {
                                      normalized = normalized.substring(1)
                                    }
                                    return normalized
                                  }
                                  
                                  return c.phone && account.phone && 
                                         normalizePhone(c.phone) === normalizePhone(account.phone)
                                })
                                
                                if (matchingChair) {
                                  setLinkingChairperson(matchingChair)
                                } else {
                                  // Just open the dialog with first unlinked chairperson
                                  setLinkingChairperson(unlinkedChairpeople[0])
                                }
                              }}
                            >
                              <LinkIcon className="h-4 w-4 mr-1" />
                              Link
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unlinked-chairpeople">
          <Card>
            <CardHeader>
              <CardTitle>Unlinked Chairpeople</CardTitle>
              <CardDescription>
                Chairpeople without linked user accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnlinkedChairpeople.map((chair) => (
                    <TableRow key={chair.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {chair.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {chair.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {chair.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No phone</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLinkingChairperson(chair)
                            setSelectedUserId("")
                          }}
                        >
                          <LinkIcon className="h-4 w-4 mr-1" />
                          Link to Account
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unlinked-volunteers">
          <Card>
            <CardHeader>
              <CardTitle>Unlinked Volunteers</CardTitle>
              <CardDescription>
                Volunteers without linked user accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnlinkedVolunteers.map((volunteer) => (
                    <TableRow key={volunteer.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {volunteer.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {volunteer.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {volunteer.email}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No email</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {volunteer.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {volunteer.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No phone</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{volunteer.type || "General"}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          No account linked
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Link Chairperson Dialog */}
      <Dialog
        open={!!linkingChairperson}
        onOpenChange={(open) => {
          if (!open) {
            setLinkingChairperson(null)
            setSelectedUserId("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Chairperson to User Account</DialogTitle>
            <DialogDescription>
              Select a user account to link to {linkingChairperson?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Chairperson</Label>
              <div className="p-2 bg-muted rounded">
                <div className="font-medium">{linkingChairperson?.name}</div>
                {linkingChairperson?.phone && (
                  <div className="text-sm text-muted-foreground">
                    Phone: {linkingChairperson.phone}
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="user-select">User Account</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="Select a user account" />
                </SelectTrigger>
                <SelectContent>
                  {linkedAccounts
                    .filter(account => !account.linked_chairperson_id)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <span>{account.discord_server_name || account.profile_name || account.email || "Unknown"}</span>
                          {(() => {
                            const normalizePhone = (phone: string) => {
                              let normalized = phone.replace(/\D/g, "")
                              if (normalized.length === 11 && normalized.startsWith("1")) {
                                normalized = normalized.substring(1)
                              }
                              return normalized
                            }
                            return account.phone && linkingChairperson?.phone && 
                                   normalizePhone(account.phone) === normalizePhone(linkingChairperson.phone) && (
                              <Badge variant="secondary" className="text-xs">Phone match</Badge>
                            )
                          })()}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setLinkingChairperson(null)
                  setSelectedUserId("")
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleLinkChairperson} disabled={!selectedUserId}>
                Link Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
