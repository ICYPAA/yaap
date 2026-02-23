"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip"
import { Check, Copy, Link2, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

type ParamField = {
  id: string
  key: string
  value: string
  disabled?: boolean
}

export default function URLGenerator() {
  const [baseUrl, setBaseUrl] = useState("https://icyhost.org/travel")
  const [params, setParams] = useState<ParamField[]>([
    { id: crypto.randomUUID(), key: "airports", value: "", disabled: true },
    {
      id: crypto.randomUUID(),
      key: "registration-cost",
      value: "40",
      disabled: true
    },
    {
      id: crypto.randomUUID(),
      key: "hotel-cost",
      value: "180",
      disabled: true
    },
    {
      id: crypto.randomUUID(),
      key: "hotel-nights",
      value: "3",
      disabled: true
    },
    { id: crypto.randomUUID(), key: "address", value: "", disabled: true },
    { id: crypto.randomUUID(), key: "", value: "" }
  ])
  const [generatedUrl, setGeneratedUrl] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    generateURL()
  }, [baseUrl, params])

  const addParam = () => {
    setParams([...params, { id: crypto.randomUUID(), key: "", value: "" }])
  }

  const removeParam = (id: string) => {
    const param = params.find((p) => p.id === id)
    if (param?.disabled) return

    if (params.filter((p) => !p.disabled).length > 1) {
      setParams(params.filter((param) => param.id !== id))
    }
  }

  const updateParam = (id: string, field: "key" | "value", value: string) => {
    setParams(
      params.map((param) =>
        param.id === id ? { ...param, [field]: value } : param
      )
    )
  }

  const generateURL = () => {
    if (!baseUrl) return

    try {
      const url = new URL(baseUrl)

      // Clear existing params
      url.search = ""

      // Add new params
      params.forEach((param) => {
        if (param.key && param.value) {
          // For airports, handle as comma-separated array
          if (param.key === "airports" && param.value) {
            url.searchParams.append(param.key, param.value)
          }
          // Skip address if it's empty
          else if (param.key === "address" && !param.value) {
            // Do nothing, skip this param
          } else if (param.key && param.value) {
            url.searchParams.append(param.key, param.value)
          }
        }
      })

      setGeneratedUrl(url.toString())
    } catch (error) {
      console.error("Invalid URL:", error)
      setGeneratedUrl("")
    }
  }

  const copyToClipboard = () => {
    if (!generatedUrl) return

    navigator.clipboard
      .writeText(generatedUrl)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch((error) => {
        console.error("Error copying to clipboard:", error)
      })
  }

  return (
    <div className="container max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Link2 className="mr-2" />
            Travel URL Generator
          </CardTitle>
          <CardDescription>
            Create custom travel URLs with query parameters for tracking or
            special functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="baseUrl" className="text-sm font-medium">
              Base URL
            </label>
            <Input
              id="baseUrl"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://icyhost.org/travel"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Parameters</label>
              <Button variant="outline" size="sm" onClick={addParam}>
                <Plus className="h-4 w-4 mr-2" />
                Add Parameter
              </Button>
            </div>

            {params.map((param) => (
              <div key={param.id} className="flex gap-2 items-center">
                <Input
                  placeholder="Key"
                  value={param.key}
                  onChange={(e) => updateParam(param.id, "key", e.target.value)}
                  className="flex-1"
                  disabled={param.disabled}
                />
                <span className="text-muted-foreground">=</span>
                <Input
                  placeholder={
                    param.key === "airports" ? "Comma separated list" : "Value"
                  }
                  value={param.value}
                  onChange={(e) =>
                    updateParam(param.id, "value", e.target.value)
                  }
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeParam(param.id)}
                  disabled={
                    param.disabled ||
                    params.filter((p) => !p.disabled).length === 1
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Generated URL</label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToClipboard}
                        disabled={!generatedUrl}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 mr-2" />
                        )}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy URL to clipboard</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="p-3 bg-muted rounded-md break-all">
                {generatedUrl || "Generated URL will appear here"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
