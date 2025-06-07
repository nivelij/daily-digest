"use client"

import { useState, useEffect, useCallback } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react"

const AVAILABLE_DATES_ENDPOINT = `${process.env.NEXT_PUBLIC_BACKEND_ENDPOINT_URL}/dates`;
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
  // State for available dates
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [loadingDates, setLoadingDates] = useState(true)
  const [datesError, setDatesError] = useState<string | null>(null)

  // State for digest data
  const [digest, setDigest] = useState<DigestDataType | null>(null)
  const [loadingDigest, setLoadingDigest] = useState(false) // Initially false, true when fetching digest
  const [digestError, setDigestError] = useState<string | null>(null)

  // Current selected date (UTC Date object)
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState("ID")

  // Get date in YYYY-MM-DD format from a UTC Date object
  const formatDateForAPI = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = ('0' + (date.getUTCMonth() + 1)).slice(-2);
    const day = ('0' + date.getUTCDate()).slice(-2);
    return `${year}-${month}-${day}`;
  }

  // Parse YYYY-MM-DD string to a UTC Date object
  const parseAPIDateStringToUTCDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  };

  // Format date for display (shows date in user's local timezone)
  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const isPreviousDayNavigationDisabled = () => {
    if (!currentDate || availableDates.length === 0) return true;
    const currentDateStr = formatDateForAPI(currentDate);
    return currentDateStr === availableDates[0]; // Assumes availableDates is sorted ascending
  };

  const isNextDayNavigationDisabled = () => {
    if (!currentDate || availableDates.length === 0) return true;
    const currentDateStr = formatDateForAPI(currentDate);
    return currentDateStr === availableDates[availableDates.length - 1]; // Assumes availableDates is sorted ascending
  };

  // Navigate to previous day
  const goToPreviousDay = () => {
    if (!currentDate || isPreviousDayNavigationDisabled()) return;
    const currentDateStr = formatDateForAPI(currentDate);
    const currentIndex = availableDates.indexOf(currentDateStr);
    if (currentIndex > 0) {
      setCurrentDate(parseAPIDateStringToUTCDate(availableDates[currentIndex - 1]));
    }
  }

  // Navigate to next day
  const goToNextDay = () => {
    if (!currentDate || isNextDayNavigationDisabled()) return;
    const currentDateStr = formatDateForAPI(currentDate);
    const currentIndex = availableDates.indexOf(currentDateStr);
    if (currentIndex < availableDates.length - 1) {
      setCurrentDate(parseAPIDateStringToUTCDate(availableDates[currentIndex + 1]));
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

  const getCategoryDisplayName = (categoryCode: string) => {
    const categoryName: Record<string, string> = {
      ID: "🇮🇩 ID Stock",
      US: "🇺🇸 US Stock",
      XAUUSD: "🧈 Gold",
      DXY: "💰 DXY",
    };
    return categoryName[categoryCode] || categoryCode;
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

  // Fetch digest data
  const fetchDigest = useCallback(async (date: Date) => {
    setLoadingDigest(true)
    setDigestError(null)

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
    } catch (err: unknown) { // Explicitly type err as unknown
      console.error("Error fetching digest:", err)

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setDigestError("Request timed out. Please check your internet connection and try again.")
        } else if (err.message.includes("Failed to fetch")) {
          setDigestError("Network error. Please check your internet connection.")
        } else {
          setDigestError(`Failed to load digest: ${err.message}`)
        }
      } else {
        setDigestError("An unexpected error occurred. Please try again.")
      }
    } finally {
      setLoadingDigest(false)
    }
  }, [activeTab]) // formatDateForAPI is stable, setters are stable. activeTab was part of old logic, removing.

  // Fetch available dates on component mount
  const fetchAvailableDates = useCallback(async () => {
    setLoadingDates(true);
    setDatesError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(AVAILABLE_DATES_ENDPOINT, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch available dates: ${response.status} ${response.statusText}`);
      }
      const dates: string[] = await response.json();
      if (!Array.isArray(dates) || !dates.every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))) {
        throw new Error("Invalid date format received from API.");
      }

      dates.sort((a, b) => a.localeCompare(b)); // Sort ascending (oldest to newest)
      setAvailableDates(dates);

      if (dates.length > 0) {
        setCurrentDate(parseAPIDateStringToUTCDate(dates[dates.length - 1])); // Set to latest date
      } else {
        setDatesError("No dates available from the source."); // Or handle as a non-error empty state
      }
    } catch (err) {
      console.error("Error fetching available dates:", err);
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setDatesError("Request for available dates timed out.");
        } else {
          setDatesError(`Failed to load available dates: ${err.message}`);
        }
      } else {
        setDatesError("An unexpected error occurred while fetching dates.");
      }
    } finally {
      setLoadingDates(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableDates();
  }, [fetchAvailableDates]);

  // Fetch digest when current date changes (and is not null)
  useEffect(() => {
    if (currentDate) {
      fetchDigest(currentDate);
    } else {
      // If currentDate is null (e.g. no available dates), clear digest
      setDigest(null);
      setLoadingDigest(false);
    }
  }, [currentDate])

  // Effect to update activeTab when digest data changes or if activeTab becomes invalid
  useEffect(() => {
    const countries = getAvailableCountries(); // Depends on `digest`
    if (countries.length > 0) {
      if (!countries.includes(activeTab)) {
        setActiveTab(countries[0]);
      }
    }
    // If countries.length is 0, activeTab remains, but UI will show "no articles"
  }, [digest, activeTab]); // getAvailableCountries is not stable, so digest is the key dependency.

  const availableCountries = getAvailableCountries()
  const currentArticles: Article[] = getArticlesForCountry(activeTab)

  if (loadingDates) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading available dates...</p>
      </div>
    );
  }

  if (datesError) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-700 dark:text-red-400 font-medium mb-2">Unable to load schedule</p>
        <p className="text-red-600 dark:text-red-300 text-sm mb-4">{datesError}</p>
        <button
          onClick={fetchAvailableDates}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (availableDates.length === 0 || !currentDate) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">No dates available to display digest for.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-md p-4">
        <h1 className="text-xl font-bold text-center text-gray-800 dark:text-white mb-2">Digest: Your Daily Summary</h1>

        {/* Date navigation */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={goToPreviousDay}
            disabled={isPreviousDayNavigationDisabled()}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous day"
          >
            <ChevronLeft className={`h-5 w-5 ${
              isPreviousDayNavigationDisabled()
                ? 'text-gray-400 dark:text-gray-600' // Muted colors for disabled icon
                : 'text-gray-600 dark:text-gray-400' // Default icon colors
            }`} />
          </button>

          <p className="text-sm text-center text-gray-500 dark:text-gray-400 min-w-0 flex-1">
            {currentDate ? formatDateForDisplay(currentDate) : "Loading date..."}
          </p>

          {currentDate && !isNextDayNavigationDisabled() ? (
            <button
              onClick={goToNextDay}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          ) : (
            <div className="w-9 h-9" /> // Placeholder to maintain spacing
          )}
        </div>

        {/* Country tabs */}
        {!loadingDigest && !digestError && availableCountries.length > 0 && (
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
                  {getCategoryDisplayName(countryCode)}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="container mx-auto px-4 py-6 max-w-md">
        {/* Loading state */}
        {loadingDigest && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading digest...</p>
          </div>
        )}

        {/* Error state */}
        {!loadingDigest && digestError && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <div>
                <p className="text-red-700 dark:text-red-400 font-medium">Unable to load digest</p>
                <p className="text-red-600 dark:text-red-300 text-sm mt-1">{digestError}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => currentDate && fetchDigest(currentDate)}
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
        {!loadingDigest && !digestError && digest && availableCountries.length > 0 && (
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
                  No articles available for {getCategoryDisplayName(activeTab)} on this date.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loadingDigest && !digestError && digest && availableCountries.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-gray-400" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">No digest available for this date.</p>
          </div>
        )}
      </main>

      <footer className="py-4 px-6 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} Hans Kristanto</p>
      </footer>
    </div>
  )
}
