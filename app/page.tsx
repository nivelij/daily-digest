"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react"

const AVAILABLE_DATES_ENDPOINT = `${process.env.NEXT_PUBLIC_BACKEND_ENDPOINT_URL}/dates`;
// 1. Define Interfaces/Types for your data structure
interface Article {
  subject: string;
  summary: string;
  links?: string[];
}

type ArticlesByCountry = Record<string, Article[]>;
type DigestDataType = [ArticlesByCountry[]];

const SWIPE_THRESHOLD = 50; // Minimum pixels for a swipe to be registered

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
  const [digestCache, setDigestCache] = useState<Record<string, DigestDataType>>({});
  
  // State for swipe/tab change animation direction
  const [direction, setDirection] = useState(0); // 0: none, 1: next (content from right), -1: prev (content from left)

  // Refs for tab indicator animation
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // const [tabIndicatorStyles, setTabIndicatorStyles] = useState({ x: 0, width: 0, opacity: 0 }); // Removed: No longer using sliding indicator

  // Ref for swipe gesture
  const touchstartXRef = useRef<number>(0);

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
      ID: "🇮🇩 IHSG",
      US: "🇺🇸 Stocks",
      XAUUSD: "🧈 Gold",
      DXY: "💰 DXY",
      Crypto: "₿ Crypto"
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
    const dateString = formatDateForAPI(date);

    // 1. Check cache first
    if (digestCache[dateString]) {
      setDigest(digestCache[dateString]);
      setDigestError(null); // Clear any previous error for this date
      setLoadingDigest(false); // Ensure loading is false if served from cache
      return; // Exit early, data served from cache
    }

    // 2. If not in cache, proceed with fetching
    setLoadingDigest(true)
    setDigestError(null)

    // Declare controller outside the try block to be accessible in catch
    const controller = new AbortController()

    try {
      // Add timeout to the client request as well
      const timeoutId = setTimeout(() => controller.abort("timeout"), 15000); // 15 second timeout, pass reason

      const response = await fetch(`/api/digest?date=${dateString}`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch digest: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      setDigest(data);
      // 3. Store in cache upon successful fetch
      setDigestCache(prevCache => ({
        ...prevCache,
        [dateString]: data,
      }));
    } catch (err: unknown) { // Explicitly type err as unknown
      console.error("Error fetching digest:", err)

      if (err instanceof Error) {
        if (err.name === "AbortError" || (controller.signal.aborted && controller.signal.reason === "timeout")) {
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
  }, [digestCache, formatDateForAPI]); // Added digestCache and formatDateForAPI
  // setDigest, setDigestError, setLoadingDigest, setDigestCache are stable setters from useState
  // formatDateForAPI is defined in component scope but doesn't depend on props/state, so it's stable.
  // Including it in dependencies for explicitness and to satisfy linters if they complain.




  // Fetch available dates on component mount
  const fetchAvailableDates = useCallback(async () => {
    setLoadingDates(true);
    setDatesError(null);
    // Declare controller outside the try block to be accessible in catch
    const controller = new AbortController();

    try {
      const timeoutId = setTimeout(() => controller.abort("timeout"), 15000); // 15 second timeout, pass reason

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
        if (err.name === "AbortError" || (controller.signal.aborted && controller.signal.reason === "timeout")) {
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

  // Effect to manage tabRefs array size when availableCountries changes
  useEffect(() => {
    const countries = getAvailableCountries(); // Depends on `digest`
    tabRefs.current = tabRefs.current.slice(0, countries.length);
  }, [digest]); // Re-run when digest changes, as getAvailableCountries depends on it

  // Helper function to change tab and set animation direction
  const changeTab = useCallback((newTabCode: string) => {
    const currentIdx = getAvailableCountries().indexOf(activeTab);
    const newIdx = getAvailableCountries().indexOf(newTabCode);
    if (newIdx === -1 || newIdx === currentIdx) return;
    setDirection(newIdx > currentIdx ? 1 : -1);
    setActiveTab(newTabCode);
  }, [activeTab, digest, setActiveTab]); // digest because getAvailableCountries depends on it
  // Fetch digest when current date changes (and is not null)
  useEffect(() => {
    if (currentDate) {
      fetchDigest(currentDate);
    } else {
      // If currentDate is null (e.g. no available dates), clear digest
      setDigest(null);
      setLoadingDigest(false);
      setDigestError(null); // Also clear any digest error
    }
  }, [currentDate, fetchDigest]); // Added fetchDigest as a dependency

  // Effect to update activeTab when digest data changes (e.g. from cache or new fetch) or if activeTab becomes invalid
  useEffect(() => {
    const countries = getAvailableCountries(); // Depends on `digest`
    if (countries.length > 0) {
      if (!activeTab || !countries.includes(activeTab)) {
        // For programmatic changes like this (e.g. initial load or data change),
        // set direction to 0 to avoid unintended slide animation from previous state.
        // Or, if you want it to animate from a default direction:
        // setDirection(1); // or -1, or based on old vs new if old activeTab existed
        setDirection(0); // No specific swipe direction for this reset
        setActiveTab(countries[0]); // This will trigger the content animation if direction is non-zero
      }
    } else {
      if (activeTab) { // If there was an active tab from a previous digest
        setActiveTab(""); // Clear activeTab if no countries are available
      }
    }
  }, [digest, activeTab, setActiveTab]); // Added setActiveTab

  // Effect for scrolling active tab into view
  useEffect(() => {
    const countries = getAvailableCountries();
    const activeIndex = countries.indexOf(activeTab);
    const activeTabElement = tabRefs.current[activeIndex];

    if (activeTabElement) {
      activeTabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab, digest]); // digest because getAvailableCountries depends on it

  const availableCountries = getAvailableCountries()

  // Swipe navigation handlers
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLElement>) => {
    // Only process single touches
    if (event.touches.length === 1) {
      touchstartXRef.current = event.touches[0].clientX;
    }
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLElement>) => {
    // Only process single touches
    if (event.changedTouches.length === 1) {
      const touchendX = event.changedTouches[0].clientX;
      const deltaX = touchendX - touchstartXRef.current;

      if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
        const currentIndex = availableCountries.indexOf(activeTab);
        if (currentIndex === -1 || availableCountries.length <= 1) return; // Active tab not found or not enough tabs

        let newIndexToNavigate;
        if (deltaX > 0) { // Swipe Right (finger moved from Left to Right) -> Go to Previous Tab
          if (currentIndex > 0) {
            newIndexToNavigate = currentIndex - 1;
          }
        } else { // Swipe Left (finger moved from Right to Left) -> Go to Next Tab
          if (currentIndex < availableCountries.length - 1) {
            newIndexToNavigate = currentIndex + 1;
          }
        }
        if (newIndexToNavigate !== undefined) {
          changeTab(availableCountries[newIndexToNavigate]);
        }
      }
    }
  }, [availableCountries, activeTab, changeTab, SWIPE_THRESHOLD]); // Use changeTab

  const contentVariants = {
    initial: (direction: number) => ({ x: direction > 0 ? "100%" : "-100%", opacity: 0, position: 'absolute' as 'absolute', width: '100%' }),
    animate: { x: 0, opacity: 1, position: 'relative' as 'relative', transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
    exit: (direction: number) => ({ x: direction < 0 ? "100%" : "-100%", opacity: 0, position: 'absolute' as 'absolute', width: '100%', transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const } }),
  };


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
        <h1 className="text-xl font-bold text-center text-gray-800 dark:text-white mb-2 flex items-center justify-center">
          <img src="/icon.png" alt="Digest Icon" className="h-6 w-6 mr-2" />
          <span>Digest: Daily Summary</span>
        </h1>

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
          // This outer div uses negative margins on mobile to counteract the header's padding,
          // making its content area effectively full-width. sm:mx-0 resets this for larger screens.
          <div className="mt-4 -mx-4 sm:mx-0">
            {/* This div centers the scrollable tab list if it doesn't overflow. */}
            <div className="flex justify-center">
              {/* The scrollable container. space-x-2 provides gap between cards. px-4 for padding inside scrollable area */}
              <div className="flex overflow-x-auto space-x-2 px-4 py-2 whitespace-nowrap no-scrollbar">
                {availableCountries.map((countryCode, index) => (
                  <button
                    key={countryCode}
                    ref={(el) => { tabRefs.current[index] = el; }}
                    onClick={() => changeTab(countryCode)}
                    className={`
                      px-4 py-2 rounded-lg text-sm transition-all duration-200 ease-in-out shadow /* Base card styles */
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 dark:focus-visible:ring-offset-gray-800 whitespace-nowrap /* Accessibility focus */
                      ${
                      activeTab === countryCode
                        ? "bg-blue-600 dark:bg-blue-500 text-white font-semibold shadow-lg" // Active card: distinct bg, white text, bolder font, stronger shadow
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600" // Inactive card: standard card appearance
                    }`}
                  >
                    {getCategoryDisplayName(countryCode)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main
        className="container mx-auto px-0 sm:px-4 py-6 max-w-md" // Adjusted px for potential full-width feel of sliding content
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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
          <div className="relative overflow-hidden min-h-[300px]"> {/* Container for animation, ensure min-height */}
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={activeTab} // Crucial for AnimatePresence to detect changes
                custom={direction}
                variants={contentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="px-4" // Add padding here if removed from main for full-width slide illusion
              >
                <div className="space-y-4">
                  {getArticlesForCountry(activeTab) && getArticlesForCountry(activeTab).length > 0 ? (
                    getArticlesForCountry(activeTab).map((item, itemIndex) => (
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
                                  href={link}
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
                    <div className="text-center py-12 px-4"> {/* Ensure padding for centered text */}
                      <FileText className="h-12 w-12 mx-auto text-gray-400" />
                      <p className="mt-4 text-gray-600 dark:text-gray-400">
                        No articles available for {getCategoryDisplayName(activeTab)} on this date.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
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
