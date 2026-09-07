import React, { useEffect, useState } from "react"
import { Modal, Platform } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { TutorialCarousel } from "./TutorialCarousel"

const TUTORIAL_SEEN_KEY = "tutorial_seen"

interface TutorialModalProps {
  visible?: boolean
  onClose?: () => void
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ 
  visible: externalVisible, 
  onClose: externalOnClose 
}) => {
  const [internalVisible, setInternalVisible] = useState(false)
  const [hasCheckedTutorial, setHasCheckedTutorial] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Check if tutorial has been seen before
  useEffect(() => {
    const checkTutorialSeen = async () => {
      try {
        const seen = await AsyncStorage.getItem(TUTORIAL_SEEN_KEY)
        console.log("Tutorial seen status:", seen)
        if (seen !== "true" && externalVisible === undefined && !isClosing) {
          // First time opening the app
          console.log("Showing tutorial for first time")
          setInternalVisible(true)
        }
        setHasCheckedTutorial(true)
      } catch (error) {
        console.error("Error checking tutorial seen status:", error)
        setHasCheckedTutorial(true)
      }
    }

    if (!hasCheckedTutorial && !isClosing) {
      checkTutorialSeen()
    }
  }, [hasCheckedTutorial, externalVisible, isClosing])

  const isVisible = externalVisible !== undefined ? externalVisible : internalVisible

  const handleClose = async () => {
    // Prevent double triggering
    if (isClosing) return
    
    setIsClosing(true)
    setInternalVisible(false)
    
    // Ensure the tutorial is marked as seen
    try {
      await AsyncStorage.setItem(TUTORIAL_SEEN_KEY, "true")
      console.log("Tutorial marked as seen in modal close handler")
    } catch (error) {
      console.error("Error marking tutorial as seen:", error)
    }
    
    externalOnClose?.()
  }

  // Workaround for React Native 0.76.9 Modal crash on Android
  // Using transparent prop and avoiding presentationStyle on Android
  const modalProps: any = {
    visible: isVisible,
    animationType: "slide",
    statusBarTranslucent: true,
    transparent: false,
    onRequestClose: handleClose // Required for Android
  }
  
  // Only add presentationStyle on iOS
  if (Platform.OS === "ios") {
    modalProps.presentationStyle = "fullScreen"
  }

  return (
    <Modal {...modalProps}>
      <SafeAreaProvider>
        <TutorialCarousel onClose={handleClose} />
      </SafeAreaProvider>
    </Modal>
  )
}

// Helper function to reset tutorial seen status (useful for testing)
export const resetTutorialSeen = async () => {
  try {
    await AsyncStorage.removeItem(TUTORIAL_SEEN_KEY)
    console.log("Tutorial seen status reset")
  } catch (error) {
    console.error("Error resetting tutorial seen status:", error)
  }
}
