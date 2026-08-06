import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react"
import { withDeviceId } from "../lib/supabase"
import { useCurrentConference } from "./CurrentConferenceContext"

interface FeatureFlags {
  child_care_enabled: boolean
  volunteering_enabled: boolean
  hospitality_enabled: boolean
  accessibility_enabled: boolean
  support_chat_enabled: boolean
  bid_schedule_enabled: boolean
  schedule_sharing_enabled: boolean
  push_notifications_enabled: boolean
  language_option_enabled: boolean
}

interface FeatureContextType {
  features: FeatureFlags
  loading: boolean
  error: string | null
  isFeatureEnabled: (featureKey: keyof FeatureFlags) => boolean
  refreshFeatures: () => Promise<void>
}

const defaultFeatures: FeatureFlags = {
  child_care_enabled: true,
  volunteering_enabled: true,
  hospitality_enabled: true,
  accessibility_enabled: true,
  support_chat_enabled: true,
  bid_schedule_enabled: true,
  schedule_sharing_enabled: true,
  push_notifications_enabled: true,
  language_option_enabled: true
}

const FeatureContext = createContext<FeatureContextType>({
  features: defaultFeatures,
  loading: true,
  error: null,
  isFeatureEnabled: () => true,
  refreshFeatures: async () => {}
})

export const useFeatures = () => {
  const context = useContext(FeatureContext)
  if (!context) {
    throw new Error("useFeatures must be used within a FeatureProvider")
  }
  return context
}

interface FeatureProviderProps {
  children: React.ReactNode
  programId?: number
}

export const FeatureProvider: React.FC<FeatureProviderProps> = ({ 
  children, 
  programId
}) => {
  const currentConference = useCurrentConference()
  const activeProgramId =
    programId ||
    (currentConference.status === "active"
      ? currentConference.currentProgramId
      : null)
  const [features, setFeatures] = useState<FeatureFlags>(defaultFeatures)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFeatures = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true)
      }
      setError(null)

      if (!activeProgramId) {
        setFeatures(defaultFeatures)
        return
      }
      
      // Add timeout to prevent hanging
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn("Feature fetch timed out after 5 seconds")
          resolve(null)
        }, 5000)
      })
      
      const supabaseWithDeviceId = await withDeviceId()
      
      const fetchPromise = supabaseWithDeviceId
        .from("programs")
        .select("features")
        .eq("id", activeProgramId)
        .single()
      
      // Race between fetching features and timeout
      const result = await Promise.race([fetchPromise, timeoutPromise])
      if (timeoutId) clearTimeout(timeoutId)
      
      if (result === null) {
        console.warn("Feature fetch timed out, using default values")
        return
      }
      
      const { data, error: fetchError } = result
      
      if (fetchError) {
        console.error("Error fetching features:", fetchError)
        setError("Failed to load feature settings")
        return
      }

      if (data?.features) {
        // Merge fetched features with defaults to ensure all keys exist
        const mergedFeatures = { ...defaultFeatures, ...data.features }
        setFeatures(mergedFeatures)
      }
    } catch (error) {
      console.error("Error loading features:", error)
      setError("Failed to load feature settings")
    } finally {
      if (isInitial) {
        setLoading(false)
      }
    }
  }, [activeProgramId])

  useEffect(() => {
    fetchFeatures(true)
  }, [fetchFeatures])

  const isFeatureEnabled = (featureKey: keyof FeatureFlags): boolean => {
    return features[featureKey] ?? true // Default to enabled if not found
  }

  const refreshFeatures = async (): Promise<void> => {
    await fetchFeatures()
  }

  const contextValue: FeatureContextType = {
    features,
    loading,
    error,
    isFeatureEnabled,
    refreshFeatures
  }

  return (
    <FeatureContext.Provider value={contextValue}>
      {children}
    </FeatureContext.Provider>
  )
}
