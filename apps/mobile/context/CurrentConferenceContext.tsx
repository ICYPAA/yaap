import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react"
import { AppState } from "react-native"
import {
  CurrentConferenceState,
  fetchAndStoreCurrentConferenceState
} from "../lib/currentConference"

type CurrentConferenceContextType = CurrentConferenceState & {
  loading: boolean
  refresh: () => Promise<void>
}

const defaultState: CurrentConferenceState = {
  status: "none",
  currentProgramId: null,
  program: null
}

const CurrentConferenceContext = createContext<CurrentConferenceContextType>({
  ...defaultState,
  loading: true,
  refresh: async () => {}
})

export const CurrentConferenceProvider = ({
  children,
  initialState
}: {
  children: React.ReactNode
  initialState?: CurrentConferenceState | null
}) => {
  const [conferenceState, setConferenceState] =
    useState<CurrentConferenceState>(initialState || defaultState)
  const [loading, setLoading] = useState(!initialState)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const nextState = await fetchAndStoreCurrentConferenceState()
      setConferenceState(nextState)
    } catch (error) {
      console.error("Error loading current conference state:", error)
      setConferenceState(defaultState)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialState) {
      refresh()
    }
  }, [initialState, refresh])

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        refresh()
      }
    })

    return () => subscription.remove()
  }, [refresh])

  return (
    <CurrentConferenceContext.Provider
      value={{
        ...conferenceState,
        loading,
        refresh
      }}
    >
      {children}
    </CurrentConferenceContext.Provider>
  )
}

export const useCurrentConference = () => {
  const context = useContext(CurrentConferenceContext)
  if (!context) {
    throw new Error(
      "useCurrentConference must be used within a CurrentConferenceProvider"
    )
  }
  return context
}
