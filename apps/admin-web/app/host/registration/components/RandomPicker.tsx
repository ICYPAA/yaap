"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Dices, DollarSign, Users } from "lucide-react"
import { useState } from "react"

interface RandomPickerProps {
  registrationData: any[]
  scholarshipData?: any[]
}

export function RandomPicker({
  registrationData,
  scholarshipData = []
}: RandomPickerProps) {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [numberOfPicks, setNumberOfPicks] = useState(1)
  const [includeScholarships, setIncludeScholarships] = useState(false)
  const [minimumScholarshipValue, setMinimumScholarshipValue] = useState(0)
  const [winners, setWinners] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)

  // Merge registration data with scholarship data
  const allData = [...registrationData]

  // Add scholarship contributions from the separate scholarships array
  if (scholarshipData && scholarshipData.length > 0) {
    // Mark scholarship contributions with proper ticket type
    const scholarshipContributions = scholarshipData.map((row) => ({
      ...row,
      "Ticket type": "Contribute to Scholarship Fund"
    }))
    allData.push(...scholarshipContributions)
  }

  // Debug: Log unique ticket types
  if (allData && allData.length > 0) {
    const uniqueTicketTypes = Array.from(
      new Set(allData.map((r) => r["Ticket type"]))
    )
    console.log("Available ticket types:", uniqueTicketTypes)
    console.log(
      "Total entries:",
      allData.length,
      "Regular:",
      registrationData.length,
      "Scholarships:",
      scholarshipData.length
    )
  }

  // Count scholarship entries (excluding "Request a Scholarship")
  const scholarshipCount = scholarshipData?.length || 0
  const regularCount =
    registrationData?.filter(
      (row) => row["Ticket type"] !== "Request a Scholarship"
    ).length || 0
  const requestScholarshipCount =
    registrationData?.filter(
      (row) => row["Ticket type"] === "Request a Scholarship"
    ).length || 0

  const handleRandomPick = () => {
    if (!allData || allData.length === 0) {
      alert("No registration data available")
      return
    }

    // Filter registrations based on scholarship inclusion preference
    let eligibleRegistrations = allData.filter((row) => {
      const ticketType = row["Ticket type"]
      const isScholarshipContribution =
        ticketType === "Contribute to Scholarship Fund"
      const isScholarshipRequest = ticketType === "Request a Scholarship"

      // Always exclude scholarship requests from the drawing
      if (isScholarshipRequest) {
        return false
      }

      // If not including scholarships, exclude scholarship contributions
      if (!includeScholarships && isScholarshipContribution) {
        return false
      }

      // If including scholarships and this is a contribution, check minimum value
      if (
        includeScholarships &&
        isScholarshipContribution &&
        minimumScholarshipValue > 0
      ) {
        // Parse the ticket price for scholarship entries (check multiple possible fields)
        const priceStr =
          row["Ticket price"] ||
          row["Total ticket price"] ||
          row["Amount"] ||
          row["Contribution"] ||
          "0"
        const price = parseFloat(String(priceStr).replace(/[^\d.-]/g, ""))
        return price >= minimumScholarshipValue
      }

      return true // Include all eligible entries
    })

    if (startDate) {
      eligibleRegistrations = eligibleRegistrations.filter((row) => {
        const orderDate = new Date(row["Order date"])
        return orderDate >= new Date(startDate + "T00:00:00")
      })
    }

    if (endDate) {
      eligibleRegistrations = eligibleRegistrations.filter((row) => {
        const orderDate = new Date(row["Order date"])
        return orderDate <= new Date(endDate + "T23:59:59")
      })
    }

    if (eligibleRegistrations.length === 0) {
      alert("No registrations found in the selected timeframe")
      return
    }

    if (numberOfPicks > eligibleRegistrations.length) {
      alert(
        `Only ${eligibleRegistrations.length} registrations available in the selected timeframe`
      )
      return
    }

    // Randomly pick winners
    const shuffled = [...eligibleRegistrations].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, numberOfPicks)

    setWinners(picked)
    setShowResults(true)
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      })
    } catch {
      return dateStr
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5" />
            Random Registration Picker
          </CardTitle>
          <CardDescription>
            Randomly select registrations from a specific timeframe for prizes
            or giveaways
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label
                htmlFor="start-date"
                className="flex items-center gap-2 mb-2"
              >
                <Calendar className="h-4 w-4" />
                Start Date (inclusive)
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label
                htmlFor="end-date"
                className="flex items-center gap-2 mb-2"
              >
                <Calendar className="h-4 w-4" />
                End Date (inclusive)
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label
                htmlFor="number-picks"
                className="flex items-center gap-2 mb-2"
              >
                <Users className="h-4 w-4" />
                Number to Pick
              </Label>
              <Input
                id="number-picks"
                type="number"
                min="1"
                max="100"
                value={numberOfPicks}
                onChange={(e) =>
                  setNumberOfPicks(parseInt(e.target.value) || 1)
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-scholarships"
                checked={includeScholarships}
                onCheckedChange={(checked) => {
                  setIncludeScholarships(checked as boolean)
                  if (!checked) setMinimumScholarshipValue(0)
                }}
              />
              <Label
                htmlFor="include-scholarships"
                className="flex items-center gap-2 cursor-pointer font-normal"
              >
                <DollarSign className="h-4 w-4" />
                Include scholarship contributions in the drawing
                <span className="text-xs text-muted-foreground ml-2">
                  ({scholarshipCount} contribution
                  {scholarshipCount !== 1 ? "s" : ""}, {regularCount} regular
                  {requestScholarshipCount > 0
                    ? `, ${requestScholarshipCount} request${requestScholarshipCount !== 1 ? "s" : ""} excluded`
                    : ""}
                  )
                </span>
              </Label>
            </div>

            {includeScholarships && (
              <div className="ml-6 flex items-center gap-3">
                <Label htmlFor="min-scholarship" className="text-sm">
                  Minimum contribution amount:
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm">$</span>
                  <Input
                    id="min-scholarship"
                    type="number"
                    min="0"
                    step="5"
                    value={minimumScholarshipValue}
                    onChange={(e) =>
                      setMinimumScholarshipValue(
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-24 h-8"
                    placeholder="0"
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  (0 = include all)
                </span>
              </div>
            )}
          </div>

          <Button
            onClick={handleRandomPick}
            className="w-full"
            disabled={!registrationData || registrationData.length === 0}
          >
            <Dices className="h-4 w-4 mr-2" />
            Pick Random Winner{numberOfPicks > 1 ? "s" : ""}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🎉 Random Pick Results</DialogTitle>
            <DialogDescription>
              {winners.length} winner{winners.length !== 1 ? "s" : ""} selected
              {startDate || endDate ? " from " : ""}
              {startDate && `${new Date(startDate).toLocaleDateString()}`}
              {startDate && endDate && " to "}
              {endDate && `${new Date(endDate).toLocaleDateString()}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {winners.map((winner, index) => (
              <Card key={index}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Winner #{index + 1}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Name:</span>{" "}
                      {winner["Guest first name"] || "N/A"}
                    </div>
                    <div>
                      <span className="font-medium">Registration Date:</span>{" "}
                      {formatDate(winner["Order date"])}
                    </div>
                    <div>
                      <span className="font-medium">Committee:</span>{" "}
                      {winner["Committee"] || "None/Unaffiliated"}
                    </div>
                    <div>
                      <span className="font-medium">Location:</span>{" "}
                      {winner["City, State"] || "N/A"}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Ticket Type:</span>{" "}
                      {winner["Ticket type"] || "N/A"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
