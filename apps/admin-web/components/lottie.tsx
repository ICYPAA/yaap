"use client"

import { useEffect, useRef, useState } from "react"

import lottie from "lottie-web"

interface LottieProps {
  maxWidth: number
  maxHeight: number
}

export const Lottie = ({ maxWidth, maxHeight }: LottieProps) => {
  const element = useRef<HTMLDivElement>(null)
  const lottieInstance = useRef<any>()

  const [width, setWidth] = useState(maxWidth)
  const [height, setHeight] = useState(maxHeight)

  useEffect(() => {
    if (element.current) {
      lottieInstance.current = lottie.loadAnimation({
        animationData: undefined,
        container: element.current
      })
    }
    return () => {
      lottieInstance.current?.destroy()
    }
  }, [undefined])

  useEffect(() => {
    console.log(window)
    if (typeof window !== "undefined") {
      setWidth(Math.min(width, window.innerWidth * 0.8))
      setHeight(Math.min(width, window.innerHeight * 0.8))
    }
  }, [])

  return (
    <div
      style={{
        width,
        height
      }}
      ref={element}
    ></div>
  )
}
