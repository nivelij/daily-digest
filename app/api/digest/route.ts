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

    const apiUrl = `${process.env.NEXT_PUBLIC_BACKEND_ENDPOINT_URL}/daily_digest?date=${date}`

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
  } catch (err: unknown) { // Explicitly type 'err' as unknown for clarity
    console.error("API route error:", err)

    // Type guard to ensure 'err' is an Error instance
    if (err instanceof Error) {
      // AbortSignal.timeout throws a DOMException with name 'TimeoutError'.
      // DOMException inherits from Error, so this check is valid.
      if (err.name === "TimeoutError") {
        return NextResponse.json(
          { error: "Request timeout - the external API took too long to respond" },
          { status: 504 },
        )
      }

      // Check for TypeError related to fetch (e.g., network issues).
      // If 'err' is an instance of TypeError, its 'name' property will be "TypeError".
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        return NextResponse.json({ error: "Network error - unable to reach the external API" }, { status: 503 })
      }
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
