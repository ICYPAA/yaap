"use client"

import { Card } from "@/components/ui/card"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

interface CountdownTimerProps {
  targetDate: string
  title?: string
}

export default function CountdownTimer({
  targetDate,
  title = "Conference Begins In"
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const calculateTimeLeft = (): TimeLeft => {
      const now = new Date().getTime()
      const target = new Date(targetDate).getTime()
      const difference = target - now

      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor(
            (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
          ),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        }
      }

      return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft())

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  if (!mounted) {
    return (
      <Card className="p-8 text-center bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-primary">
          {title}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 0, 0, 0].map((_, index) => (
            <div key={index} className="text-center">
              <div className="bg-background/80 backdrop-blur-sm rounded-lg p-4 shadow-lg border">
                <div className="text-3xl md:text-4xl font-bold text-primary">
                  00
                </div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {["Days", "Hours", "Minutes", "Seconds"][index]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  const timeUnits = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hours" },
    { value: timeLeft.minutes, label: "Minutes" },
    { value: timeLeft.seconds, label: "Seconds" }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card className="p-8 text-center bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 shadow-xl">
        <motion.h2
          className="text-2xl md:text-3xl font-bold mb-6 text-primary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {title}
        </motion.h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {timeUnits.map((unit, index) => (
            <motion.div
              key={unit.label}
              className="text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index, duration: 0.4 }}
            >
              <div className="bg-background/80 backdrop-blur-sm rounded-lg p-4 shadow-lg border hover:shadow-xl transition-shadow duration-300">
                <motion.div
                  className="text-3xl md:text-4xl font-bold text-primary"
                  key={unit.value} // This key causes re-render animation when value changes
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {String(unit.value).padStart(2, "0")}
                </motion.div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {unit.label}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="mt-6 text-lg font-semibold text-primary/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          August 28-31, 2025 • Minneapolis, Minnesota
        </motion.p>
      </Card>
    </motion.div>
  )
}
