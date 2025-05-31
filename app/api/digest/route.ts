import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get("date")

    if (!date) {
      return NextResponse.json({ error: "Date parameter is required" }, { status: 400 })
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 })
    }

    const apiUrl = `https://x7lreie3ib.execute-api.eu-central-1.amazonaws.com/live/daily_digest?date=${date}`

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Daily-Digest-App/1.0",
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      console.error(`External API error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: `External API returned ${response.status}: ${response.statusText}` },
        { status: response.status },
      )
    }

    const data = await response.json()

    // Add CORS headers for client-side requests
    return NextResponse.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (error) {
    console.error("API route error:", error)

    if (error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Request timeout - the external API took too long to respond" },
        { status: 504 },
      )
    }

    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return NextResponse.json({ error: "Network error - unable to reach the external API" }, { status: 503 })
    }

    return NextResponse.json({ error: "Internal server error while fetching digest" }, { status: 500 })
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
