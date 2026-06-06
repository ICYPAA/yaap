"use client"

import { getRegistrations } from "@/app/host/registration/actions"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { normalizeCountry, parseLocationData } from "@/utils/location-parser"
import { AlbersUsa } from "@visx/geo"
import { geoCentroid } from "d3-geo"
import { useEffect, useState } from "react"
import * as topojson from "topojson-client"
import type { Topology } from "topojson-specification"
import stateAbbrs from "./us-abbr.json"
import topology from "./usa-topo.json"

interface FeatureShape {
  type: "Feature"
  id: string
  geometry: { coordinates: [number, number][][]; type: "Polygon" }
  properties: { name: string }
}

const usTopology = topology as unknown as Topology
const statesFeatureCollection = topojson.feature(usTopology, usTopology.objects.states)
const { features: unitedStates } = statesFeatureCollection as {
  type: "FeatureCollection"
  features: FeatureShape[]
}

type StateCount = {
  state: string
  count: number
}

type UnmatchedUSRecord = {
  orderDate: string
  cityState: string
  committee: string
  country: string
}

type RegistrationRow = {
  "Ticket type"?: string
  "City, State"?: string
  "Order date"?: string
  Committee?: string
  Country?: string
}

type RegistrationReport = {
  created_at: string
  data?: RegistrationRow[]
}

// Color scale based on number of registrations
const getColor = (value: number) => {
  if (value > 250) return "#450A0A" // Even darker red
  if (value > 100) return "#7F1D1D"
  if (value > 50) return "#991B1B"
  if (value > 30) return "#B91C1C"
  if (value > 10) return "#EF4444"
  if (value > 0) return "#FCA5A5" // Lightest red
  return "#f3f4f6" // Default gray for no registrations
}

export default function USGraph() {
  const [stateData, setStateData] = useState<StateCount[]>([])
  const [unmatchedUSRecords, setUnmatchedUSRecords] = useState<
    UnmatchedUSRecord[]
  >([])
  const [selectedState, setSelectedState] = useState<StateCount | null>(null)
  const [displayLabels, setDisplayLabels] = useState(true)

  useEffect(() => {
    const fetchRegistrationData = async () => {
      try {
        const registrationResult = await getRegistrations()
        const registrations = Array.isArray(registrationResult)
          ? (registrationResult as unknown as RegistrationReport[])
          : []
        const latestReport = registrations.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]

        if (!latestReport?.data) return

        const stateCount: Record<string, number> = {}
        const remainingRecords: RegistrationRow[] = []

        // First pass: try to match states and cities, track what doesn't match
        latestReport.data
          .filter(
            (row) =>
              row["Ticket type"] !== "Contribute to Scholarship Fund"
          )
          .forEach((row) => {
            const state = parseLocationData(row["City, State"] || "")
            if (state) {
              stateCount[state] = (stateCount[state] || 0) + 1
            } else {
              // This record didn't match a state or city, keep it for further analysis
              remainingRecords.push(row)
            }
          })

        // Second pass: check remaining records for US country indicators
        const unmatchedUS: UnmatchedUSRecord[] = []
        remainingRecords.forEach((row) => {
          const normalizedCountry = normalizeCountry(row.Country || "")
          if (normalizedCountry === "United States") {
            unmatchedUS.push({
              orderDate: row["Order date"] || "Unknown",
              cityState: row["City, State"] || "Unknown",
              committee: row.Committee || "Unknown",
              country: row.Country || "Unknown"
            })
          }
        })

        const formattedData = Object.entries(stateCount).map(
          ([state, count]) => ({
            state,
            count
          })
        )

        setStateData(formattedData)
        setUnmatchedUSRecords(unmatchedUS)
      } catch (error) {
        console.error("Failed to fetch registration data:", error)
      }
    }

    fetchRegistrationData()
  }, [])

  const width = 800
  const height = 500
  const centerX = width / 2
  const centerY = height / 2
  const scale = (width + height) / 1.55

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex gap-4 w-full">
          <div style={{ height, width: "75%" }}>
            <svg
              width={width}
              height={height}
              className="bg-background rounded-r-lg"
            >
              <AlbersUsa<FeatureShape>
                data={unitedStates}
                scale={scale}
                translate={[centerX, centerY - 25]}
              >
                {({ features }) =>
                  features.map(({ feature, path, projection }, i) => {
                    const coords = projection(geoCentroid(feature))
                    const abbr =
                      stateAbbrs[feature.id as keyof typeof stateAbbrs]
                    const stateInfo = stateData.find(
                      (d) => d.state === feature.properties.name
                    )
                    const count = stateInfo?.count || 0

                    return (
                      <g key={`map-feature-${i}`}>
                        <path
                          d={path || ""}
                          fill={getColor(count)}
                          stroke="white"
                          strokeWidth={0.5}
                          onClick={() => setSelectedState(stateInfo || null)}
                          style={{ cursor: "pointer" }}
                        >
                          <title>{`${feature.properties.name}: ${count} registrations`}</title>
                        </path>
                        {displayLabels && coords && (
                          <text
                            transform={`translate(${coords})`}
                            fontSize={Math.max(width / 75, 9)}
                            style={{
                              fill: count > 0 ? "#FFF" : "#374151", // Text color based on registration count
                              fontFamily: "sans-serif",
                              cursor: "default"
                            }}
                            textAnchor="middle"
                          >
                            {abbr}
                          </text>
                        )}
                      </g>
                    )
                  })
                }
              </AlbersUsa>
            </svg>
          </div>

          <Card className="p-4 w-1/4 rounded-l-none">
            <h3 className="font-semibold mb-4">Legend</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ background: "#FCA5A5" }}
                />
                <span>1-10 registrations</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ background: "#EF4444" }}
                />
                <span>11-30 registrations</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ background: "#B91C1C" }}
                />
                <span>31-50 registrations</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ background: "#991B1B" }}
                />
                <span>51-100 registrations</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ background: "#7F1D1D" }}
                />
                <span>101-250 registrations</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ background: "#450A0A" }}
                />
                <span>250+ registrations</span>
              </div>
            </div>

            {selectedState && (
              <div className="mt-8">
                <h4 className="font-semibold mb-2">Selected State</h4>
                <p>{selectedState.state}</p>
                <p>{selectedState.count} registrations</p>
              </div>
            )}

            <div className="mt-8 flex items-center gap-2">
              <input
                type="checkbox"
                checked={displayLabels}
                onChange={() => setDisplayLabels(!displayLabels)}
                id="display-labels"
              />
              <label htmlFor="display-labels">Display state labels</label>
            </div>
          </Card>
        </div>
      </div>

      {/* Unmatched US Records Section */}
      {unmatchedUSRecords.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="unmatched-us-records">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  {unmatchedUSRecords.length}
                </Badge>
                US Registrations Not Matching Any State or City
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Card>
                <CardHeader>
                  <p className="text-sm text-muted-foreground">
                    These registrations have a country indicating United States
                    but their city/state couldn&apos;t be matched to any US state or
                    major city. This may indicate data entry issues, missing
                    mappings, or locations that need to be added to the city
                    database.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {unmatchedUSRecords.map((record, index) => (
                      <div
                        key={index}
                        className="flex flex-wrap items-center gap-4 p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            Order Date
                          </span>
                          <span className="font-medium">
                            {record.orderDate}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            City, State
                          </span>
                          <span className="font-medium">
                            {record.cityState}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            Committee
                          </span>
                          <span className="font-medium">
                            {record.committee}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">
                            Country (Original)
                          </span>
                          <span className="font-medium">{record.country}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  )
}
