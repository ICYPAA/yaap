import * as Sentry from "@sentry/react-native"

// Define severity level type to match Sentry's expectations
type SeverityLevel = "fatal" | "error" | "warning" | "info" | "debug"

// Simple Sentry logger that only sends errors to Sentry, not debug logs
const SentryLogger = {
  // Initialize Sentry if not in dev mode
  init(): void {
    if (!__DEV__) {
      try {
        Sentry.init({
          dsn: "https://1ea0da963ccb239ecdda5272f5714d14@o4509172639203328.ingest.us.sentry.io/4509172641628160",
          enableNative: false, // JS only to work with EAS Update
          tracesSampleRate: 0.2,
          environment: "production",
          // Filter out debug and info messages
          beforeSend(event) {
            // Only send error and warning level events
            if (event.level === "debug" || event.level === "info") {
              return null // Don't send to Sentry
            }
            return event
          }
        })
        console.log("Sentry initialized for error tracking only")
      } catch (error) {
        console.error("Failed to initialize Sentry:", error)
      }
    }
  },

  // Log an error to Sentry (always sent)
  captureError(error: unknown, context: Record<string, any> = {}): void {
    try {
      if (!__DEV__) {
        Sentry.captureException(error, { extra: context })
      }
      // Always log to console for debugging
      console.error("[Error]", error, context)
    } catch (e) {
      console.error("Failed to log error to Sentry:", e)
    }
  },

  // Log a message to Sentry (filtered by severity in production)
  captureMessage(
    message: string,
    level: SeverityLevel = "info",
    context: Record<string, any> = {}
  ): void {
    try {
      // In production, only send error and warning messages to Sentry
      if (!__DEV__) {
        if (level === "error" || level === "warning" || level === "fatal") {
          Sentry.captureMessage(message, {
            level,
            extra: context
          })
        }
      }
      
      // Always log to console for debugging
      const logMethod = level === "error" || level === "fatal" ? "error" : 
                       level === "warning" ? "warn" : "log"
      console[logMethod](`[${level.toUpperCase()}]`, message, context)
    } catch (e) {
      console.error("Failed to log message:", e)
    }
  },

  // Add a breadcrumb for tracking user flow (only in production for errors)
  addBreadcrumb(
    category: string,
    message: string,
    data: Record<string, any> = {},
    level: "info" | "warning" | "error" = "info"
  ): void {
    try {
      // Only add breadcrumbs in production and for important events
      if (!__DEV__) {
        // Skip routine/debug breadcrumbs
        const skipCategories = ["navigation", "url", "debug", "routine"]
        if (!skipCategories.includes(category.toLowerCase())) {
          Sentry.addBreadcrumb({
            category,
            message,
            data,
            level
          })
        }
      }
      // Console log in development
      if (__DEV__) {
        console.log(`[Breadcrumb] ${category}: ${message}`, data)
      }
    } catch (e) {
      console.error("Failed to add breadcrumb:", e)
    }
  },

  // Set current user for error attribution
  setUser(id: string): void {
    try {
      if (!__DEV__) {
        Sentry.setUser({ id })
      }
      console.log("[User] Set ID:", id.substring(0, 8) + "...")
    } catch (e) {
      console.error("Failed to set user:", e)
    }
  }
}

// Export the logger as default
export default SentryLogger
