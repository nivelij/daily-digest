"use client"

import { useState, useEffect, SetStateAction, Key } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react"

// 1. Define Interfaces/Types for your data structure
interface Article {
  subject: string;
  summary: string;
  links?: string[];
}

// Represents an object like: { "ID": Article[], "US": Article[] }
type ArticlesByCountry = Record<string, Article[]>;

// Digest data structure: An array containing a single element,
// which is an array of ArticlesByCountry objects. e.g., [ [ { "ID": [...] }, { "US": [...] } ] ]
type DigestDataType = [ArticlesByCountry[]];

export default function DailyDigest() {
  const [digest, setDigest] = useState<DigestDataType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(() => {
    // Initialize with yesterday's date
    const date = new Date()
    date.setDate(date.getDate() - 1)
    return date
  })
  const [activeTab, setActiveTab] = useState("ID")

  // Get date in YYYY-MM-DD format
  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split("T")[0]
  }

  // Format date for display
  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Check if current date is yesterday (today - 1)
  const isYesterday = () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return formatDateForAPI(currentDate) === formatDateForAPI(yesterday)
  }

  // Navigate to previous day
  const goToPreviousDay = () => {
    const previousDay = new Date(currentDate)
    previousDay.setDate(previousDay.getDate() - 1)
    setCurrentDate(previousDay)
  }

  // Navigate to next day
  const goToNextDay = () => {
    if (!isYesterday()) {
      const nextDay = new Date(currentDate)
      nextDay.setDate(nextDay.getDate() + 1)
      setCurrentDate(nextDay)
    }
  }

  // Get available countries from digest data
  const getAvailableCountries = () => {
    if (!digest || !digest[0]) return []

    const countries: string[] = []
    digest[0].forEach((category: ArticlesByCountry) => {
      Object.keys(category).forEach((countryCode) => {
        if (!countries.includes(countryCode)) {
          countries.push(countryCode)
        }
      })
    })
    return countries
  }

  // Get country display name
  const getCountryDisplayName = (countryCode: string) => {
    const countryNames: Record<string, string> = {
      ID: "🇮🇩 Indonesia",
      US: "🇺🇸 United States",
    };
    return countryNames[countryCode] || countryCode;
  }

  // Get articles for a specific country
  const getArticlesForCountry = (countryCode: string) => {
    if (!digest || !digest[0]) return []

    const articles: Article[] = []
    digest[0].forEach((category: ArticlesByCountry) => {
      if (category[countryCode] && category[countryCode].length > 0) {
        articles.push(...category[countryCode])
      }
    })
    return articles
  }

  // Fetch digest data from our API route
  const fetchDigest = async (date = currentDate) => {
    setLoading(true)
    setError(null)

    try {
      const dateString = formatDateForAPI(date)

      // Add timeout to the client request as well
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      const response = await fetch(`/api/digest?date=${dateString}`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch digest: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setDigest(data)

      // Set active tab to first available country
      const availableCountriesList: string[] = [] // Renamed to avoid conflict and corrected type
      if (data && data[0]) {
        (data[0] as ArticlesByCountry[]).forEach((category: ArticlesByCountry) => { // Added type assertion for safety
          Object.keys(category).forEach((countryCode: string) => {
            if (!availableCountries.includes(countryCode)) {
              availableCountries.push(countryCode)
            }
          })
        })
        if (availableCountries.length > 0 && !availableCountries.includes(activeTab)) {
          setActiveTab(availableCountries[0])
        }
      }
    } catch (err: unknown) { // Explicitly type err as unknown
      console.error("Error fetching digest:", err)

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setError("Request timed out. Please check your internet connection and try again.")
        } else if (err.message.includes("Failed to fetch")) {
          // This specific check might be brittle if the browser's "Failed to fetch" message changes.
          // Consider checking for err instanceof TypeError if that's what network errors typically are.
          setError("Network error. Please check your internet connection.")
        } else {
          setError(`Failed to load digest: ${err.message}`)
        }
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Fetch digest when current date changes
  useEffect(() => {
    fetchDigest(currentDate)
  }, [currentDate])

  const availableCountries = getAvailableCountries()
  const currentArticles: Article[] = getArticlesForCountry(activeTab)

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-md p-4">
        <h1 className="text-xl font-bold text-center text-gray-800 dark:text-white mb-2">Digest: Your Daily Summary</h1>

        {/* Date navigation */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>

          <p className="text-sm text-center text-gray-500 dark:text-gray-400 min-w-0 flex-1">
            {formatDateForDisplay(currentDate)}
          </p>

          {!isYesterday() && (
            <button
              onClick={goToNextDay}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}

          {isYesterday() && (
            <div className="w-9 h-9" /> // Placeholder to maintain spacing
          )}
        </div>

        {/* Country tabs */}
        {!loading && !error && availableCountries.length > 0 && (
          <div className="flex justify-center mt-4">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {availableCountries.map((countryCode) => (
                <button
                  key={countryCode}
                  onClick={() => setActiveTab(countryCode)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === countryCode
                      ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {getCountryDisplayName(countryCode)}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="container mx-auto px-4 py-6 max-w-md">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading digest...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <div>
                <p className="text-red-700 dark:text-red-400 font-medium">Unable to load digest</p>
                <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => fetchDigest(currentDate)}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )}

        {/* Content - Tab view */}
        {!loading && !error && digest && availableCountries.length > 0 && (
          <div className="space-y-4">
            {currentArticles && currentArticles.length > 0 ? (
              currentArticles.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
                >
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-2">{item.subject}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{item.summary}</p>

                  {item.links && item.links.length > 0 && (
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-3">
                        {item.links.map((link: string, linkIndex: number) => (
                          <a
                            key={linkIndex}
                            href={link} // link is now guaranteed to be a string
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          > 
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Source {linkIndex + 1}
                          </a>
                        ))} 
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-gray-400" />
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                  No articles available for {getCountryDisplayName(activeTab)} on this date.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && digest && availableCountries.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">No digest available for this date.</p>
          </div>
        )}
      </main>

      <footer className="py-4 px-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} Daily Digest App</p>
      </footer>
    </div>
  )
}
