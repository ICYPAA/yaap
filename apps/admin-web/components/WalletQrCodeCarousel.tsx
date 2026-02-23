"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import QRCode from "qrcode"
import { useEffect, useState } from "react"

interface QRCodeData {
  id: string
  url: string
  title: string
  description: string
  downloadUrl: string
}

interface WalletQrCodeCarouselProps {
  qrCodes: QRCodeData[]
  size?: number
}

export function WalletQrCodeCarousel({
  qrCodes,
  size = 180
}: WalletQrCodeCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const generateQRCodes = async () => {
      const urls: Record<string, string> = {}

      for (const qrCode of qrCodes) {
        try {
          const dataUrl = await QRCode.toDataURL(qrCode.url, {
            width: size,
            margin: 1,
            color: {
              dark: "#000000",
              light: "#ffffff"
            }
          })
          urls[qrCode.id] = dataUrl
        } catch (err) {
          console.error(`Error generating QR code for ${qrCode.id}:`, err)
        }
      }

      setQrDataUrls(urls)
    }

    generateQRCodes()
  }, [qrCodes, size])

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % qrCodes.length)
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + qrCodes.length) % qrCodes.length)
  }

  const currentQrCode = qrCodes[currentIndex]

  if (!currentQrCode) return null

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Navigation and QR Code */}
      <div className="relative flex items-center space-x-4">
        {qrCodes.length > 1 && (
          <Button
            variant="outline"
            size="icon"
            onClick={prevSlide}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-col items-center">
          {qrDataUrls[currentQrCode.id] ? (
            <div className="p-2 bg-white rounded-lg">
              <Image
                src={qrDataUrls[currentQrCode.id]}
                alt={`QR Code for ${currentQrCode.title}`}
                width={size}
                height={size}
                className="rounded-sm"
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-center bg-gray-200 rounded-lg"
              style={{ width: size, height: size }}
            >
              <span className="text-sm text-gray-500">Loading QR Code...</span>
            </div>
          )}

          <h3 className="font-medium text-center mt-4">
            {currentQrCode.title}
          </h3>
          <p className="text-sm text-muted-foreground text-center mt-1 px-2">
            {currentQrCode.description}
          </p>
        </div>

        {qrCodes.length > 1 && (
          <Button
            variant="outline"
            size="icon"
            onClick={nextSlide}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Download Button */}
      <Button asChild className="w-full max-w-xs">
        <Link href={currentQrCode.downloadUrl}>
          <Download className="mr-2 h-4 w-4" />
          Download Pass
        </Link>
      </Button>

      {/* Dots Indicator */}
      {qrCodes.length > 1 && (
        <div className="flex space-x-2">
          {qrCodes.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
