"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
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
import { normalizeCountry, parseLocationData } from "@/utils/location-parser"
import { ChevronDown, ChevronUp, Plus, Trash2, User } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RandomPicker } from "./components/RandomPicker"
import { useFormState } from "react-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import {
  addCommitteeMapping,
  getCommitteeMappings,
  getRegistrations,
  removeCommitteeMapping,
  submitRegistrationForm
} from "./actions"
import { COUNTRY_MAPPINGS } from "./constants"

interface RegistrationReport {
  id: string
  registrations: number
  created_at: string
  countries: number
  us_states: number
  scholarships?: {
    total: number
    rows: any[]
  }
  user: {
    name: string
    avatar_url: string
  }
}

type ProcessedData = {
  total: number
  countries: Record<string, number>
  us_states: Record<string, number>
  data: any[]
  scholarships?: {
    total: number
    rows: any[]
  }
}

type MonthlyBreakdown = {
  [key: string]: number
}

type DateBreakdownType = "month" | "day"

type DateBreakdown = {
  [key: string]: number
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // Keep letters and numbers
    .trim()
}

function getMonthYearKey(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
}

function getDateKey(dateStr: string, breakdownType: DateBreakdownType): string {
  const date = new Date(dateStr)

  switch (breakdownType) {
    case "month":
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
    case "day":
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`
  }
}

function formatDate(dateStr: string, format: string): string {
  const date = new Date(dateStr)
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ]

  return format
    .replace("MMM", months[date.getMonth()])
    .replace("MM", (date.getMonth() + 1).toString().padStart(2, "0"))
    .replace("DD", date.getDate().toString().padStart(2, "0"))
    .replace("YY", date.getFullYear().toString().slice(-2))
    .replace("YYYY", date.getFullYear().toString())
}

function formatDateKey(
  key: string,
  dateBreakdownType: DateBreakdownType
): string {
  switch (dateBreakdownType) {
    case "month": {
      const [year, month] = key.split("-")
      return formatDate(`${year}-${month}-15`, "MMM YY")
    }
    case "day": {
      const [year, month, day] = key.split("-")
      return formatDate(`${year}-${month}-${day}`, "MMM DD")
    }
  }
}

const BID_COMMITTEES = [
  "Wisconsin",
  "Chicago",
  "Michigan",
  "Memphis",
  "Florida",
  "Dallas",
  "Arizona",
  "SoCal Unified",
  "CIA (Seattle)",
  "Denver"
]

interface CustomMapping {
  id: number
  input_name: string
  mapped_to: string
  created_at: string
  created_by: string | null
}

interface CommitteeAssignmentProps {
  customMappings: CustomMapping[]
  setCustomMappings: React.Dispatch<React.SetStateAction<CustomMapping[]>>
}

function CommitteeAssignmentInterface({
  customMappings,
  setCustomMappings
}: CommitteeAssignmentProps) {
  const [newInputName, setNewInputName] = useState("")
  const [newMappedTo, setNewMappedTo] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  // Get built-in mappings relevant to our bid committees from database
  const builtInMappings = useMemo(() => {
    const relevantMappings: Array<{ inputName: string; mappedTo: string }> = []

    customMappings.forEach((mapping) => {
      if (BID_COMMITTEES.includes(mapping.mapped_to)) {
        relevantMappings.push({
          inputName: mapping.input_name,
          mappedTo: mapping.mapped_to
        })
      }
    })

    return relevantMappings.sort((a, b) => a.mappedTo.localeCompare(b.mappedTo))
  }, [customMappings])

  const addCustomMapping = async () => {
    if (!newInputName.trim() || !newMappedTo || loading) return

    setLoading(true)
    try {
      console.log(
        "Adding committee mapping:",
        newInputName.trim(),
        "->",
        newMappedTo
      )
      const result = await addCommitteeMapping(newInputName.trim(), newMappedTo)
      console.log("Add mapping result:", result)

      if (result.error) {
        console.error("Error adding mapping:", result.error)
        const errorMsg = result?.error?.message || JSON.stringify(result.error)
        alert(`Failed to add mapping: ${errorMsg}`)
      } else if (result.data) {
        console.log("Mapping added successfully:", result.data)
        setCustomMappings([...customMappings, result.data])
        setNewInputName("")
        setNewMappedTo("")
        console.log(
          "Updated customMappings, new length:",
          customMappings.length + 1
        )
      }
    } catch (error) {
      console.error("Error adding mapping:", error)
      alert(`Failed to add mapping: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMapping = async (id: number) => {
    setLoading(true)
    try {
      const result = await removeCommitteeMapping(id)
      if (result.error) {
        console.error("Error removing mapping:", result.error)
        // Could show a toast here
      } else {
        setCustomMappings(customMappings.filter((mapping) => mapping.id !== id))
      }
    } catch (error) {
      console.error("Error removing mapping:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Collapsible Header */}
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-between p-4 h-auto"
      >
        <div className="flex flex-col items-start">
          <h3 className="text-lg font-semibold">Committee Name Mappings</h3>
          <p className="text-sm text-muted-foreground">
            Manage how committee names are mapped to bid committees
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
      </Button>

      {isExpanded && (
        <div className="space-y-6 border-t pt-4">
          {/* Built-in Mappings */}
          <div>
            <h4 className="text-md font-semibold mb-3">
              Built-in Committee Mappings
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              These are automatically recognized variations for the bid
              committees:
            </p>

            {customMappings.length === 0 ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <div>Loading committee mappings...</div>
                <div className="text-xs">
                  If this persists, check the console for errors or ensure the
                  database is running.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="text-xs"
                >
                  Refresh Page
                </Button>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground mb-2">
                  Total mappings loaded: {customMappings.length} | Relevant
                  mappings: {builtInMappings.length}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {BID_COMMITTEES.map((committee) => {
                    const variations = builtInMappings
                      .filter((mapping) => mapping.mappedTo === committee)
                      .map((mapping) => mapping.inputName)

                    return (
                      <Card key={committee}>
                        <CardContent className="p-4">
                          <h4 className="font-medium text-sm mb-2">
                            {committee}
                          </h4>
                          <div className="text-xs text-muted-foreground space-y-1">
                            {variations.length > 0 ? (
                              variations.map((variation) => (
                                <div
                                  key={variation}
                                  className="px-2 py-1 bg-muted rounded font-mono"
                                >
                                  {variation}
                                </div>
                              ))
                            ) : (
                              <div className="text-muted-foreground italic">
                                No variations defined
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Custom Mappings */}
          <div>
            <h4 className="text-md font-semibold mb-3">
              Custom Committee Mappings
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Add custom mappings for committee names that aren't automatically
              recognized:
            </p>

            {/* Add New Mapping Form */}
            <div className="flex space-x-4 mb-4">
              <Input
                placeholder="Committee name (as it appears in registrations)"
                value={newInputName}
                onChange={(e) => setNewInputName(e.target.value)}
                className="flex-1"
              />
              <Select value={newMappedTo} onValueChange={setNewMappedTo}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Maps to..." />
                </SelectTrigger>
                <SelectContent>
                  {BID_COMMITTEES.map((committee) => (
                    <SelectItem key={committee} value={committee}>
                      {committee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={addCustomMapping}
                disabled={!newInputName.trim() || !newMappedTo || loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {/* Custom Mappings Table */}
            {customMappings.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Input Name</TableHead>
                    <TableHead>Maps To</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-mono text-sm">
                        {mapping.input_name}
                      </TableCell>
                      <TableCell>{mapping.mapped_to}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={loading}
                          onClick={() => handleRemoveMapping(mapping.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {customMappings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No custom mappings defined yet. Add one above to get started.
              </div>
            )}
          </div>

          {/* Integration Info */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
            <h5 className="font-medium mb-2">Current Status</h5>
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="mt-3">
                <strong>
                  Active custom mappings ({customMappings.length}):
                </strong>{" "}
                {customMappings.length > 0
                  ? customMappings
                      .map((m) => `"${m.input_name}" → ${m.mapped_to}`)
                      .join(", ")
                  : "None defined"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RegistrationNumbersPage() {
  const [state, formAction] = useFormState(submitRegistrationForm, null)
  const formRef = useRef<HTMLFormElement>(null)
  const t = useTranslations("pages.registration.RegistrationNumbersPage")
  const [registrations, setRegistrations] = useState<any[]>([])
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null)
  const [dateBreakdownType, setDateBreakdownType] =
    useState<DateBreakdownType>("month")
  const [customMappings, setCustomMappings] = useState<CustomMapping[]>([])

  useEffect(() => {
    const fetchEvents = async () => {
      const reg = await getRegistrations()
      setRegistrations(reg as any[])
      formRef.current?.reset()
    }

    fetchEvents()
  }, [state])

  useEffect(() => {
    if (state?.registration) {
      setProcessedData(state.registration as ProcessedData)
    }
  }, [state])

  // Fetch committee mappings
  useEffect(() => {
    const fetchMappings = async () => {
      try {
        console.log("Starting to fetch committee mappings...")

        // Try both approaches to see which one works
        console.log("Trying server action...")
        const serverMappings = await getCommitteeMappings()
        console.log("Server mappings:", serverMappings)

        console.log("Trying API route...")
        const apiResponse = await fetch("/api/committee-mappings")
        const apiMappings = await apiResponse.json()
        console.log("API mappings:", apiMappings)

        // Use server action result if available, fallback to API
        let mappings = serverMappings?.length > 0 ? serverMappings : apiMappings

        // If both fail, use sample data for testing
        if (!mappings || mappings.length === 0) {
          console.log("No mappings found, using sample data...")
          mappings = [
            { input_name: "wibidforicypaa", mapped_to: "Wisconsin" },
            { input_name: "wisconsin", mapped_to: "Wisconsin" },
            { input_name: "wibid", mapped_to: "Wisconsin" },
            { input_name: "mib", mapped_to: "Michigan" },
            { input_name: "michigan", mapped_to: "Michigan" },
            { input_name: "michiganbid", mapped_to: "Michigan" },
            { input_name: "fbi", mapped_to: "Florida" },
            { input_name: "florida", mapped_to: "Florida" },
            { input_name: "floridabid", mapped_to: "Florida" },
            { input_name: "chicago", mapped_to: "Chicago" },
            { input_name: "chicagobid", mapped_to: "Chicago" }
          ]
        }

        console.log("Final mappings to use:", mappings?.length, "items")
        setCustomMappings(mappings || [])
      } catch (error) {
        console.error("Error fetching committee mappings:", error)
        setCustomMappings([]) // Set empty array on error to stop loading state
      }
    }
    fetchMappings()
  }, [])

  // Get the latest registration report by created_at date
  const latestReport =
    registrations.length > 0
      ? registrations.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
      : null

  // Committee normalization for display using database mappings
  const normalizeCommitteeForDisplay = useCallback(
    (committee: string): string => {
      if (!committee || committee === "None/Unaffiliated") {
        return committee || "None/Unaffiliated"
      }

      const cleanedCommittee = committee.toLowerCase().trim()
      const condensedNormalized = cleanedCommittee.replace(/[^a-z0-9]/g, "")

      // Check database mappings - exact match first
      const exactMatch = customMappings.find(
        (mapping: CustomMapping) => mapping.input_name === cleanedCommittee
      )
      if (exactMatch) {
        return exactMatch.mapped_to
      }

      // Check condensed normalized match
      const condensedMatch = customMappings.find(
        (mapping: CustomMapping) => mapping.input_name === condensedNormalized
      )
      if (condensedMatch) {
        return condensedMatch.mapped_to
      }

      // Return original if no mapping found
      return committee
    },
    [customMappings]
  )

  // Calculate country and state breakdowns from raw data
  const breakdowns = useMemo(() => {
    if (!latestReport?.data) return null

    const countryCount: Record<string, number> = {}
    const stateCount: Record<string, number> = {}
    const committeeCount: Record<string, number> = {}
    const dateCount: DateBreakdown = {}
    const unmappedCountries: Record<string, number> = {}
    const unmappedStates: Record<string, number> = {}

    latestReport.data
      .filter(
        (row: any) => row["Ticket type"] !== "Contribute to Scholarship Fund"
      )
      .forEach((row: any) => {
        // Count countries
        const normalizedCountry = normalizeCountry(row.Country || "")
        // Only count countries that are in our known country list
        if (
          Object.values(COUNTRY_MAPPINGS).includes(normalizedCountry) ||
          normalizedCountry === "United States"
        ) {
          countryCount[normalizedCountry] =
            (countryCount[normalizedCountry] || 0) + 1
        } else {
          // Track unmapped countries with their original values
          const originalCountry = row.Country || "(empty)"
          unmappedCountries[originalCountry] =
            (unmappedCountries[originalCountry] || 0) + 1
        }

        // Count states for US entries
        if (normalizedCountry === "United States") {
          const state = parseLocationData(row["City, State"])
          if (state) {
            stateCount[state] = (stateCount[state] || 0) + 1
          } else {
            // Track unmapped US city/state entries with their original values
            const originalCityState = row["City, State"] || "(empty)"
            unmappedStates[originalCityState] =
              (unmappedStates[originalCityState] || 0) + 1
          }
        }

        // Count committees (normalize for display using database mappings)
        const rawCommittee = row.Committee || "None/Unaffiliated"
        const normalizedCommittee = normalizeCommitteeForDisplay(rawCommittee)
        committeeCount[normalizedCommittee] =
          (committeeCount[normalizedCommittee] || 0) + 1

        // Count by date
        const dateKey = getDateKey(row["Order date"], dateBreakdownType)
        dateCount[dateKey] = (dateCount[dateKey] || 0) + 1
      })

    return {
      countries: countryCount,
      states: stateCount,
      committees: committeeCount,
      dates: dateCount,
      unmappedCountries: unmappedCountries,
      unmappedStates: unmappedStates
    }
  }, [latestReport?.data, dateBreakdownType, normalizeCommitteeForDisplay])

  // Bid committees to focus on
  const BID_COMMITTEES = [
    "Wisconsin",
    "Chicago",
    "Michigan",
    "Memphis",
    "Florida",
    "Dallas",
    "Arizona",
    "SoCal Unified",
    "CIA (Seattle)",
    "Denver"
  ]

  // Committee Bar Chart Component
  const CommitteeBarChart = ({ data }: { data: Record<string, number> }) => {
    const { bidCommittees, unmappedCommittees } = useMemo(() => {
      const bidCommitteeData: Record<string, number> = {}
      const unmappedData: Record<string, number> = {}

      // Initialize bid committees to 0
      BID_COMMITTEES.forEach((committee) => {
        bidCommitteeData[committee] = 0
      })

      // Process all committee data
      Object.entries(data).forEach(([committee, count]) => {
        if (committee === "None/Unaffiliated") return

        if (BID_COMMITTEES.includes(committee)) {
          bidCommitteeData[committee] = count
        } else {
          unmappedData[committee] = count
        }
      })

      return {
        bidCommittees: bidCommitteeData,
        unmappedCommittees: unmappedData
      }
    }, [data])

    const chartData = useMemo(() => {
      return BID_COMMITTEES.map((committee) => ({
        committee,
        registrations: bidCommittees[committee] || 0
      })).sort((a, b) => b.registrations - a.registrations)
    }, [bidCommittees])

    const chartConfig = {
      registrations: {
        label: "Registrations",
        color: "hsl(var(--chart-1))"
      }
    } satisfies ChartConfig

    // Calculate a dynamic height for the chart to ensure bars are readable
    const chartHeight = Math.max(400, chartData.length * 35)

    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          No committee data available
        </div>
      )
    }

    return (
      <div>
        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: `${chartHeight}px` }}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{
              left: 10
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="committee"
              type="category"
              width={140}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <XAxis dataKey="registrations" type="number" />
            <Tooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar
              dataKey="registrations"
              fill="var(--color-registrations)"
              radius={4}
            >
              <LabelList
                dataKey="registrations"
                position="right"
                style={{ fontSize: "12px", fill: "currentColor" }}
              />
            </Bar>
          </BarChart>
        </ChartContainer>

        {/* Unmapped Committees Section */}
        {Object.keys(unmappedCommittees).length > 0 && (
          <div className="mt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="unmapped-committees">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      {Object.values(unmappedCommittees).reduce(
                        (a, b) => a + b,
                        0
                      )}
                    </Badge>
                    Unmapped Committee Entries
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="text-sm text-muted-foreground mb-2">
                    These committee entries couldn't be matched to known bid
                    committees and may need review:
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Original Entry</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(unmappedCommittees)
                        .sort(([, a], [, b]) => b - a)
                        .map(([committee, count]) => (
                          <TableRow key={committee}>
                            <TableCell className="font-mono text-sm">
                              {committee || "(empty)"}
                            </TableCell>
                            <TableCell className="text-right">
                              {count}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>

      <form ref={formRef} action={formAction} className="mb-8 space-y-4">
        <div className="flex space-x-4">
          <Input
            name="registrations-file"
            type="file"
            accept=".xlsx,.xls"
            required
          />
          <Button type="submit">Upload Registrations</Button>
        </div>
        {state?.error && <p className="text-red-500">{state.error}</p>}
        {state?.success && <p className="text-green-500">{state.success}</p>}
      </form>

      {processedData && (
        <Card className="p-4 mb-8">
          <h2 className="text-xl font-semibold mb-4">Registration Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="font-medium">Total Registrations</h3>
              <p className="text-2xl">{processedData.total}</p>
            </div>
            <div>
              <h3 className="font-medium">Countries</h3>
              {Object.entries(processedData.countries).map(
                ([country, count]) => (
                  <div key={country} className="flex justify-between">
                    <span>{country}</span>
                    <span>{count}</span>
                  </div>
                )
              )}
            </div>
            <div>
              <h3 className="font-medium">Top US States</h3>
              {Object.entries(processedData.us_states)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([state, count]) => (
                  <div key={state} className="flex justify-between">
                    <span>{state}</span>
                    <span>{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.totalRegistrations.header")}</TableHead>
            <TableHead>{t("table.countries.header")}</TableHead>
            <TableHead>{t("table.usStates.header")}</TableHead>
            <TableHead>{t("table.scholarships.header")}</TableHead>
            <TableHead>{t("table.submittedOn.header")}</TableHead>
            <TableHead>{t("table.submittedBy.header")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.map((reg) => (
            <TableRow key={reg.id}>
              <TableCell>{reg.registrations}</TableCell>
              <TableCell>{reg.countries}</TableCell>
              <TableCell>{reg.us_states}</TableCell>
              <TableCell>
                {reg.scholarships?.total
                  ? `$${reg.scholarships.total.toFixed(2)} (${reg.scholarships.rows.length} contributions)`
                  : "N/A"}
              </TableCell>
              <TableCell>
                {new Date(reg.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="flex items-center space-x-2">
                <Avatar>
                  <AvatarImage src={reg.user.avatar_url} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <span>{reg.user.name}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {latestReport?.scholarships && (
        <Card className="my-8">
          <CardHeader>
            <CardTitle>Scholarship Fund Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Contributions:</span>
              <span className="text-lg font-semibold">
                {latestReport.scholarships.rows.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Pool Amount:</span>
              <span className="text-lg font-semibold">
                ${latestReport.scholarships.total.toFixed(2)}
              </span>
            </div>
            <div className="border-t pt-3">
              <div className="text-sm text-muted-foreground mb-2">
                Ticket Coverage
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">At $50 per ticket:</span>
                <span className="text-lg font-semibold">
                  {Math.floor(latestReport.scholarships.total / 50)} tickets
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">At $45 per ticket:</span>
                <span className="text-lg font-semibold">
                  {Math.floor(latestReport.scholarships.total / 45)} tickets
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {latestReport?.data && breakdowns && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">
            Latest Registration Details
            <span className="text-sm font-normal ml-2 text-gray-600">
              {new Date(latestReport.created_at).toLocaleDateString()}
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Countries Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Countries Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(breakdowns.countries)
                        .sort(([, a], [, b]) => b - a)
                        .map(([country, count]) => (
                          <TableRow key={country}>
                            <TableCell>{country}</TableCell>
                            <TableCell className="text-right">
                              {count}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>

              {/* Unmapped Countries Section */}
              {breakdowns.unmappedCountries &&
                Object.keys(breakdowns.unmappedCountries).length > 0 && (
                  <CardFooter className="pt-0">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="unmapped-countries">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">
                              {Object.values(
                                breakdowns.unmappedCountries
                              ).reduce((a, b) => a + b, 0)}
                            </Badge>
                            Unmapped Country Entries
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="text-sm text-muted-foreground mb-2">
                            These entries couldn't be matched to known countries
                            and may need review:
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Original Entry</TableHead>
                                <TableHead className="text-right">
                                  Count
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.entries(breakdowns.unmappedCountries)
                                .sort(([, a], [, b]) => b - a)
                                .map(([country, count]) => (
                                  <TableRow key={country}>
                                    <TableCell className="font-mono text-sm">
                                      {country || "(empty)"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {count}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardFooter>
                )}
            </Card>

            {/* US States Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>US States Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(breakdowns.states)
                        .sort(([, a], [, b]) => b - a)
                        .map(([state, count]) => (
                          <TableRow key={state}>
                            <TableCell>{state}</TableCell>
                            <TableCell className="text-right">
                              {count}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>

              {/* Unmapped US States Section */}
              {breakdowns.unmappedStates &&
                Object.keys(breakdowns.unmappedStates).length > 0 && (
                  <CardFooter className="pt-0">
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="unmapped-states">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">
                              {Object.values(breakdowns.unmappedStates).reduce(
                                (a, b) => a + b,
                                0
                              )}
                            </Badge>
                            Unmapped US City/State Entries
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="text-sm text-muted-foreground mb-2">
                            These US entries couldn't be matched to known
                            states/cities and may need review:
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>
                                  Original City, State Entry
                                </TableHead>
                                <TableHead className="text-right">
                                  Count
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.entries(breakdowns.unmappedStates)
                                .sort(([, a], [, b]) => b - a)
                                .map(([cityState, count]) => (
                                  <TableRow key={cityState}>
                                    <TableCell className="font-mono text-sm">
                                      {cityState || "(empty)"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {count}
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardFooter>
                )}
            </Card>

            {/* Date Breakdown */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Date Breakdown</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={
                        dateBreakdownType === "month" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setDateBreakdownType("month")}
                    >
                      Month
                    </Button>
                    <Button
                      variant={
                        dateBreakdownType === "day" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setDateBreakdownType("day")}
                    >
                      Day
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(breakdowns.dates)
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .map(([dateKey, count]) => (
                          <TableRow key={dateKey}>
                            <TableCell>
                              {formatDateKey(dateKey, dateBreakdownType)}
                            </TableCell>
                            <TableCell className="text-right">
                              {count}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Committee Breakdown */}
            <Card className="md:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle>Committee Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[500px] overflow-y-auto">
                  <CommitteeBarChart data={breakdowns.committees} />
                </div>
              </CardContent>
              <CardFooter>
                <div className="w-full text-sm text-muted-foreground space-y-1 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span>
                      Total committees shown:{" "}
                      {
                        Object.keys(breakdowns.committees).filter(
                          (c) => c !== "None/Unaffiliated"
                        ).length
                      }
                    </span>
                    <span className="font-medium">
                      {Object.entries(breakdowns.committees)
                        .filter(([c]) => c !== "None/Unaffiliated")
                        .reduce((sum, [, count]) => sum + count, 0)}{" "}
                      registrations
                    </span>
                  </div>

                  {(breakdowns.committees["None/Unaffiliated"] || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span>None/Unaffiliated:</span>
                      <span className="font-medium">
                        {breakdowns.committees["None/Unaffiliated"]}{" "}
                        registrations
                      </span>
                    </div>
                  )}
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* Committee Assignment Interface */}
      <Card className="mt-8">
        <CardContent className="p-4">
          <CommitteeAssignmentInterface
            customMappings={customMappings}
            setCustomMappings={setCustomMappings}
          />
        </CardContent>
      </Card>

      {/* Random Picker Widget */}
      {latestReport?.data && (
        <div className="mt-8">
          <RandomPicker 
            registrationData={latestReport.data} 
            scholarshipData={latestReport.scholarships?.rows || []}
          />
        </div>
      )}
    </div>
  )
}
