"use client"

import { Card } from "@/components/ui/card"
import Image from "next/image"
import QRCode from "qrcode"
import { useEffect, useState } from "react"

interface WalletQrCodeProps {
  url: string
  size?: number
  title?: string
  description?: string
}

export function WalletQrCode({
  url,
  size = 200,
  title = "Scan for Apple Wallet",
  description = "Scan this QR code with your iOS device to add to Apple Wallet"
}: WalletQrCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("")

  useEffect(() => {
    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: size,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff"
          }
        })
        setQrDataUrl(dataUrl)
      } catch (err) {
        console.error("Error generating QR code:", err)
      }
    }

    generateQR()
  }, [url, size])

  return (
    <Card className="p-4 flex flex-col items-center max-w-xs mx-auto">
      {qrDataUrl ? (
        <div className="p-2 bg-white rounded-lg">
          <Image
            src={qrDataUrl}
            alt="QR Code for Apple Wallet"
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

      {title && <h3 className="font-medium text-center mt-4">{title}</h3>}

      {description && (
        <p className="text-sm text-muted-foreground text-center mt-1 px-2">
          {description}
        </p>
      )}
    </Card>
  )
}
