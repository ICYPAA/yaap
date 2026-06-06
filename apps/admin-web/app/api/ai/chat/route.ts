import { NextRequest, NextResponse } from "next/server"
import { getCurrentProgramOrNull } from "@/lib/conference-state"
import {
  formatProgramDate,
  formatProgramDateRange,
  formatProgramLocation,
  toDateOnly
} from "@/lib/program-utils"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const ALLOWED_DOMAINS = [
  "icyhost.org",
  "localhost:3000",
  "localhost",
  "icypaa.life"
]

export async function POST(request: NextRequest) {
  // Domain validation
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")

  const isAllowedOrigin =
    origin && ALLOWED_DOMAINS.some((domain) => origin.includes(domain))

  const isAllowedReferer =
    referer && ALLOWED_DOMAINS.some((domain) => referer.includes(domain))

  if (!isAllowedOrigin && !isAllowedReferer) {
    return NextResponse.json(
      { error: "Unauthorized: Access denied" },
      { status: 403 }
    )
  }

  try {
    const requestData = await request.json()
    const { location, nearestAirport, startDate, endDate } = requestData
    const program = await getCurrentProgramOrNull()

    // Use provided dates or default to conference dates
    const travelStartDate = startDate || toDateOnly(program?.start_date)
    const travelEndDate = endDate || toDateOnly(program?.end_date)
    const conferenceName = program?.title || "the current conference"
    const conferenceDestination = formatProgramLocation(program)
    const conferenceDateRange = formatProgramDateRange(program)

    if (!travelStartDate || !travelEndDate) {
      return NextResponse.json(
        { error: "Conference travel dates are not configured" },
        { status: 400 }
      )
    }

    if (!location && !nearestAirport) {
      return NextResponse.json(
        { error: "Location or airport code is required" },
        { status: 400 }
      )
    }

    // Build a prompt for Gemini based on the inputs
    let prompt =
      "You are a flight search assistant. Please provide realistic flight information in JSON format "

    if (nearestAirport) {
      prompt += `for flights from ${nearestAirport} to ${conferenceDestination} `
    } else if (location) {
      prompt += `from the nearest major airport to coordinates ${location.lat},${location.lng} to ${conferenceDestination} `
    }

    prompt += `for ${conferenceName} travel dates:
- Departure: ${travelStartDate} (${formatProgramDate(travelStartDate)})
- Return: ${travelEndDate} (${formatProgramDate(travelEndDate)})

This is for ${conferenceName} at ${conferenceDestination} (${conferenceDateRange}). Please provide 3-5 realistic flight options with CURRENT MARKET PRICING for these specific dates.

IMPORTANT PRICING GUIDANCE:
- Use realistic, competitive pricing that reflects today's market rates
- Consider budget airlines and economy fares
- Typical domestic flights in the US range from $150-$350 for economy
- International flights typically range from $300-$800 depending on distance
- Do NOT inflate prices for conference demand - use standard market rates
- Include a mix of budget and premium airline options

Return ONLY a valid JSON object with this exact structure (no additional text):
{
  "flights": [
    {
      "airline": "American Airlines",
      "price": "287",
      "direct": true,
      "duration": "2h 45m",
      "logoUrl": ""
    }
  ]
}

Important:
- Use realistic airline names that serve these routes
- Price should be a string with just the number (no $ symbol)
- Use CURRENT MARKET PRICING, not inflated estimates
- Duration should be realistic for the route distance
- Set direct to true for nonstop flights, false for connecting
- logoUrl can be empty string
- Provide 3-5 different flight options with varying prices and airlines
- Include budget-friendly options in the $150-$300 range for domestic flights
`

    // Call Gemini API with the current model name
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 32,
            topP: 0.8,
            maxOutputTokens: 2048
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error("Gemini API Error:", errorText)
      return NextResponse.json(
        { error: "Failed to fetch flight information from AI service" },
        { status: 500 }
      )
    }

    const geminiData = await geminiResponse.json()

    // Extract the text response from Gemini
    const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!textResponse) {
      return NextResponse.json(
        { error: "No response from AI service" },
        { status: 404 }
      )
    }

    // Try to extract and parse the JSON data from the response
    try {
      // Clean the response and look for JSON structure
      let cleanedResponse = textResponse.trim()

      // Remove any markdown code block markers
      cleanedResponse = cleanedResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")

      // Look for JSON structure in the response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
      const jsonString = jsonMatch ? jsonMatch[0] : cleanedResponse

      // Parse the JSON data
      const flightData = JSON.parse(jsonString)

      // Validate the structure
      if (!flightData.flights || !Array.isArray(flightData.flights)) {
        throw new Error("Invalid flight data structure")
      }

      // Ensure price format consistency and add missing fields
      const processedFlights = flightData.flights.map(
        (flight: any, index: number) => ({
          airline: flight.airline || `Airline ${index + 1}`,
          price: flight.price?.toString() || "450",
          direct: flight.direct !== undefined ? flight.direct : index === 0, // First flight is usually direct
          duration: flight.duration || "2h 30m",
          logoUrl: flight.logoUrl || ""
        })
      )

      return NextResponse.json({
        flights: processedFlights,
        timestamp: new Date().toISOString(),
        conferenceInfo: {
          startDate: travelStartDate,
          endDate: travelEndDate,
          destination: `${conferenceDestination} - ${conferenceName}`
        }
      })
    } catch (parseError) {
      console.error("Error parsing JSON from Gemini response:", parseError)
      console.error("Raw response:", textResponse)

      // Fallback: create some realistic dummy data based on the airport
      const fallbackFlights = generateFallbackFlights()

      return NextResponse.json({
        flights: fallbackFlights,
        timestamp: new Date().toISOString(),
        note: "Using fallback data due to AI parsing error",
        conferenceInfo: {
          startDate: travelStartDate,
          endDate: travelEndDate,
          destination: `${conferenceDestination} - ${conferenceName}`
        }
      })
    }
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json(
      { error: "Failed to process flight search request" },
      { status: 500 }
    )
  }
}

// Generate fallback flight data when AI parsing fails
function generateFallbackFlights() {
  const airlines = [
    "American Airlines",
    "Delta Air Lines",
    "United Airlines",
    "Southwest Airlines",
    "Alaska Airlines"
  ]
  const basePrice = 180 + Math.floor(Math.random() * 120) // 180-300 range for more realistic pricing

  return airlines.slice(0, 4).map((airline, index) => ({
    airline,
    price: (basePrice + index * 15 + Math.floor(Math.random() * 30)).toString(), // Smaller price increments
    direct: index < 2, // First two are direct
    duration: index < 2 ? "2h 15m" : "4h 35m", // Direct vs connecting
    logoUrl: ""
  }))
}
