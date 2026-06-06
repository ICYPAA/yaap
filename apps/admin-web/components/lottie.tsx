"use client"

import { useEffect, useRef, useState } from "react"

import lottie, { type AnimationItem } from "lottie-web"

interface LottieProps {
  maxWidth: number
  maxHeight: number
}

export const Lottie = ({ maxWidth, maxHeight }: LottieProps) => {
  const element = useRef<HTMLDivElement>(null)
  const lottieInstance = useRef<AnimationItem | null>(null)

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
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWidth(Math.min(maxWidth, window.innerWidth * 0.8))
      setHeight(Math.min(maxHeight, window.innerHeight * 0.8))
    }
  }, [maxHeight, maxWidth])

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
