import React, { createContext, useContext, useEffect, useState } from "react"
import { getDebugMode, setDebugMode } from "../lib/storage"

type DebugContextType = {
  isDebugMode: boolean
  toggleDebugMode: () => void
}

const DebugContext = createContext<DebugContextType>({
  isDebugMode: false,
  toggleDebugMode: () => {}
})

export const useDebug = () => useContext(DebugContext)

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false)
  const [isLoaded, setIsLoaded] = useState<boolean>(false)

  // Load debug mode from storage on mount
  useEffect(() => {
    const loadDebugMode = async () => {
      const savedMode = await getDebugMode()
      setIsDebugMode(savedMode)
      setIsLoaded(true)
    }

    loadDebugMode()
  }, [])

  const toggleDebugMode = async () => {
    const newMode = !isDebugMode
    setIsDebugMode(newMode)
    await setDebugMode(newMode)
  }

  if (!isLoaded) {
    return null // Or return a loading component
  }

  return (
    <DebugContext.Provider value={{ isDebugMode, toggleDebugMode }}>
      {children}
    </DebugContext.Provider>
  )
}
