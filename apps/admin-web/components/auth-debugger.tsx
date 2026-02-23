"use client"

import { debugAuthState } from "@/utils/supabase/debug"
import { useState } from "react"
import { Button } from "./ui/button"

export default function AuthDebugger() {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const checkAuth = async () => {
    setLoading(true)
    try {
      const result = await debugAuthState()
      setDebugInfo(result)
    } catch (error) {
      console.error("Error checking auth state:", error)
      setDebugInfo({ error })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border p-4 my-4 rounded-md">
      <h3 className="text-xl mb-2">Auth Debugger</h3>
      <Button onClick={checkAuth} disabled={loading} variant="outline">
        {loading ? "Checking..." : "Check Auth State"}
      </Button>

      {debugInfo && (
        <div className="mt-4">
          <h4 className="font-bold mb-2">Debug Information:</h4>
          <div className="bg-gray-100 p-2 rounded overflow-auto max-h-96">
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
