<template>
  <div class="min-h-screen bg-gray-100 dark:bg-gray-900">
    <header class="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-md p-4">
      <h1 class="text-xl font-bold text-center text-gray-800 dark:text-white">Digest: Your Daily Summary</h1>
      <p class="text-sm text-center text-gray-500 dark:text-gray-400">{{ formattedDate }}</p>
    </header>

    <main class="container mx-auto px-4 py-6 max-w-md">
      <!-- Loading state -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-12">
        <div class="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
        <p class="mt-4 text-gray-600 dark:text-gray-400">Loading digest...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-md">
        <div class="flex items-center">
          <AlertTriangleIcon class="h-5 w-5 text-red-500 mr-2" />
          <p class="text-red-700 dark:text-red-400">{{ error }}</p>
        </div>
        <button 
          @click="fetchDigest" 
          class="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
        >
          Try Again
        </button>
      </div>

      <!-- Content -->
      <div v-else-if="digest && digest.length > 0" class="space-y-6">
        <div v-for="(category, categoryIndex) in digest[0]" :key="categoryIndex" class="space-y-4">
          <div v-for="(categoryData, categoryName) in category" :key="categoryName">
            <div 
              class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
              :class="{'mb-6': categoryIndex < digest[0].length - 1}"
            >
              <button 
                @click="toggleCategory(categoryName)" 
                class="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <h2 class="text-lg font-bold text-gray-800 dark:text-white">
                  {{ categoryName === 'ID' ? 'Indonesia' : categoryName }}
                </h2>
                <ChevronDownIcon 
                  class="h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform duration-200" 
                  :class="{'transform rotate-180': expandedCategories[categoryName]}" 
                />
              </button>
              
              <div v-if="expandedCategories[categoryName]" class="divide-y divide-gray-200 dark:divide-gray-700">
                <div 
                  v-for="(item, itemIndex) in categoryData" 
                  :key="itemIndex" 
                  class="p-4 hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <h3 class="font-semibold text-gray-800 dark:text-white mb-2">{{ item.subject }}</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">{{ item.summary }}</p>
                  
                  <div v-if="item.links && item.links.length > 0" class="mt-2">
                    <div class="flex flex-wrap gap-2">
                      <a 
                        v-for="(link, linkIndex) in item.links" 
                        :key="linkIndex" 
                        :href="link" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <ExternalLinkIcon class="h-3 w-3 mr-1" />
                        Source {{ linkIndex + 1 }}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!loading && digest" class="text-center py-12">
        <FileIcon class="h-12 w-12 mx-auto text-gray-400" />
        <p class="mt-4 text-gray-600 dark:text-gray-400">No digest available for this date.</p>
      </div>
    </main>

    <footer class="py-4 px-6 text-center text-xs text-gray-500 dark:text-gray-400">
      <p>© {{ new Date().getFullYear() }} Hans Kristanto</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { AlertTriangleIcon, ChevronDownIcon, ExternalLinkIcon, FileIcon } from 'lucide-vue-next'

// State
const digest = ref(null)
const loading = ref(true)
const error = ref(null)
const expandedCategories = ref({})

// Get yesterday's date in YYYY-MM-DD format
const getYesterdayDate = () => {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

// Format date for display (e.g., "May 29, 2025")
const formattedDate = computed(() => {
  if (!digest.value) return 'Loading...'
  
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  
  return yesterday.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

// Toggle category expansion
const toggleCategory = (categoryName) => {
  expandedCategories.value = {
    ...expandedCategories.value,
    [categoryName]: !expandedCategories.value[categoryName]
  }
}

// Fetch digest data from API
const fetchDigest = async () => {
  loading.value = true
  error.value = null
  
  try {
    const yesterdayDate = getYesterdayDate()
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_ENDPOINT_URL}/daily_digest?date=${yesterdayDate}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch digest: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    digest.value = data
    
    // Auto-expand the first category
    if (data && data[0]) {
      const firstCategory = Object.keys(data[0])[0]
      if (firstCategory) {
        expandedCategories.value[firstCategory] = true
      }
    }
  } catch (err) {
    console.error('Error fetching digest:', err)
    error.value = `Failed to load digest: ${err.message}`
  } finally {
    loading.value = false
  }
}

// Initialize
onMounted(() => {
  fetchDigest()
})
</script>

<style>
/* Additional styles can be added here if needed */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  touch-action: manipulation;
}

/* Dark mode media query */
@media (prefers-color-scheme: dark) {
  body {
    background-color: #121212;
    color: #e0e0e0;
  }
}
</style>
