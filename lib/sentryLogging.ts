import * as Sentry from "@sentry/react-native"

// Define severity level type to match Sentry's expectations
type SeverityLevel = "fatal" | "error" | "warning" | "info" | "debug"

// Simple Sentry logger that works without external dependencies
const SentryLogger = {
  // Initialize Sentry if not in dev mode
  init(): void {
    if (!__DEV__) {
      try {
        Sentry.init({
          // DSN should be configured - already set in app/linking.tsx
          dsn: "https://1ea0da963ccb239ecdda5272f5714d14@o4509172639203328.ingest.us.sentry.io/4509172641628160",
          enableNative: false, // JS only to work with EAS Update
          tracesSampleRate: 0.2,
          environment: "production"
        })
        console.log("Sentry initialized")
      } catch (error) {
        console.error("Failed to initialize Sentry:", error)
      }
    }
  },

  // Log an error to Sentry
  captureError(error: unknown, context: Record<string, any> = {}): void {
    try {
      // Remove the dev check to allow events in development
      Sentry.captureException(error, { extra: context })
      console.log("[Sentry] Captured error", error, context)
    } catch (e) {
      console.error("Failed to log error to Sentry:", e)
    }
  },

  // Log a message to Sentry
  captureMessage(
    message: string,
    level: SeverityLevel = "info",
    context: Record<string, any> = {}
  ): void {
    try {
      // Remove the dev check to allow events in development
      Sentry.captureMessage(message, {
        level,
        extra: context
      })
      console.log(`[Sentry] Captured message (${level}):`, message, context)
    } catch (e) {
      console.error("Failed to log message to Sentry:", e)
    }
  },

  // Add a breadcrumb for tracking user flow
  addBreadcrumb(
    category: string,
    message: string,
    data: Record<string, any> = {}
  ): void {
    try {
      Sentry.addBreadcrumb({
        category,
        message,
        data,
        level: "info"
      })
    } catch (e) {
      console.error("Failed to add breadcrumb:", e)
    }
  },

  // Set current user for error attribution
  setUser(id: string): void {
    try {
      // Remove the dev check to allow user identification in development
      Sentry.setUser({ id })
      console.log("[Sentry] Set user ID:", id)
    } catch (e) {
      console.error("Failed to set user:", e)
    }
  }
}

// Export the logger as default
export default SentryLogger
