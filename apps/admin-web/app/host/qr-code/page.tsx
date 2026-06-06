"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Download, QrCode } from "lucide-react"
import { useTheme } from "next-themes"
import QRCode from "qrcode"
import { useCallback, useEffect, useRef, useState } from "react"

export default function QRGenerator() {
  const [url, setUrl] = useState("https://icypaa.org")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [size, setSize] = useState(512)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme, systemTheme } = useTheme()

  // Determine if we should use dark mode for the QR code
  const isDarkTheme =
    theme === "dark" || (theme === "system" && systemTheme === "dark")

  // Generate QR code with theme-aware colors
  const generateQRCode = useCallback(async () => {
    if (!url) return

    try {
      const canvas = canvasRef.current
      if (canvas) {
        await QRCode.toCanvas(canvas, url, {
          width: size,
          margin: 2,
          color: {
            dark: isDarkTheme ? "#ffffff" : "#000000", // Foreground color
            light: isDarkTheme ? "#1f1f23" : "#ffffff" // Background color
          }
        })
        setQrDataUrl(canvas.toDataURL("image/png"))
      }
    } catch (error) {
      console.error("Error generating QR code:", error)
    }
  }, [url, size, isDarkTheme])

  // Update QR code on theme change
  useEffect(() => {
    generateQRCode()
  }, [generateQRCode, theme, systemTheme])

  // Set QR code size based on screen width
  useEffect(() => {
    const handleResize = () => {
      const newSize = Math.min(512, window.innerWidth - 64)
      setSize(newSize)
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Download QR code as image
  const downloadQRCode = () => {
    if (!qrDataUrl) return

    const link = document.createElement("a")
    link.href = qrDataUrl
    link.download = `qrcode-${new Date().getTime()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="container max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <QrCode className="mr-2" />
            QR Code Generator
          </CardTitle>
          <CardDescription>
            Create a QR code for any URL that links to the ICYPAA website or
            other resources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="url" className="text-sm font-medium">
              Enter URL
            </label>
            <Input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://icypaa.org"
              className="flex-1"
            />
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-card rounded-lg">
            <canvas
              ref={canvasRef}
              width={size}
              height={size}
              className="mb-4 shadow-md rounded-lg"
            />
            <Button
              onClick={downloadQRCode}
              className="w-full sm:w-auto"
              disabled={!qrDataUrl}
            >
              <Download className="mr-2 h-4 w-4" />
              Download QR Code
            </Button>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6 flex justify-between flex-col sm:flex-row">
          <p className="text-sm text-muted-foreground">
            The QR code updates automatically as you type.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
