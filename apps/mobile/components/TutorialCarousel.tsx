import React, { useState, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Platform
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTheme } from "../context/ThemeContext"
import { useFeatures } from "../context/FeatureContext"
import { IconSymbol } from "./ui/IconSymbol"
import AsyncStorage from "@react-native-async-storage/async-storage"

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const TUTORIAL_SEEN_KEY = "tutorial_seen"

interface TutorialPage {
  id: string
  icon: string
  title: string
  description: string
  featureKey?: keyof ReturnType<typeof useFeatures>["features"]
}

const tutorialPages: TutorialPage[] = [
  {
    id: "welcome",
    icon: "hand.wave",
    title: "Welcome to YAAP!",
    description:
      "Your conference companion app with features to enhance your ICYPAA experience"
  },
  {
    id: "program",
    icon: "calendar",
    title: "Customized Program",
    description:
      "Browse the full conference schedule, save events to create your personal schedule, and filter by event type"
  },
  {
    id: "sharing",
    icon: "square.and.arrow.up",
    title: "Program Sharing",
    description:
      "Share your schedule with friends using QR codes and see which events your friends are attending",
    featureKey: "schedule_sharing_enabled"
  },
  {
    id: "notifications",
    icon: "bell",
    title: "Push Notifications",
    description:
      "Stay updated with schedule changes, hospitality updates, and important announcements",
    featureKey: "push_notifications_enabled"
  },
  {
    id: "maps",
    icon: "map",
    title: "Floor Maps",
    description:
      "Navigate the venue with interactive floor maps showing meeting rooms, amenities, and important locations"
  },
  {
    id: "accessibility",
    icon: "accessibility",
    title: "Accessibility Services",
    description:
      "Request accessibility accommodations to ensure you have the support you need during the conference",
    featureKey: "accessibility_enabled"
  },
  {
    id: "childcare",
    icon: "figure.and.child.holdinghands",
    title: "Childcare Services",
    description:
      "Information about childcare services available during conference hours for parents attending",
    featureKey: "child_care_enabled"
  },
  {
    id: "support",
    icon: "message",
    title: "Support Chat",
    description:
      "Get help from the host committee through our support chat feature for any questions or concerns",
    featureKey: "support_chat_enabled"
  },
  {
    id: "activities",
    icon: "fork.knife",
    title: "Local Activities & Dining",
    description:
      "Discover nearby restaurants, attractions, and activities recommended for conference attendees"
  },
  {
    id: "done",
    icon: "checkmark.circle",
    title: "You're All Set!",
    description:
      "Enjoy the conference! You can always revisit this tutorial from your profile settings"
  }
]

interface TutorialCarouselProps {
  onClose: () => void
}

export const TutorialCarousel: React.FC<TutorialCarouselProps> = ({
  onClose
}) => {
  const { theme } = useTheme()
  const { isFeatureEnabled } = useFeatures()
  const [currentPage, setCurrentPage] = useState(0)
  const scrollViewRef = useRef<ScrollView>(null)

  // Filter pages based on feature toggles
  const visiblePages = tutorialPages.filter((page) => {
    if (!page.featureKey) return true
    return isFeatureEnabled(page.featureKey)
  })

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const page = Math.round(offsetX / SCREEN_WIDTH)
    setCurrentPage(page)
  }

  const handleSkip = async () => {
    await AsyncStorage.setItem(TUTORIAL_SEEN_KEY, "true")
    onClose()
  }

  const handleDone = async () => {
    await AsyncStorage.setItem(TUTORIAL_SEEN_KEY, "true")
    onClose()
  }

  const goToPage = (pageIndex: number) => {
    scrollViewRef.current?.scrollTo({
      x: pageIndex * SCREEN_WIDTH,
      animated: true
    })
  }

  const isLastPage = currentPage === visiblePages.length - 1

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        {!isLastPage && (
          <TouchableOpacity
            onPress={handleSkip}
            testID="tutorial-skip"
            accessibilityLabel="Skip tutorial"
            style={[
              styles.skipButton,
              Platform.OS === "android" && styles.skipButtonAndroid
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.skipText, { color: theme.colors.text.secondary }]}
            >
              Skip
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {visiblePages.map((page, index) => (
          <View key={page.id} style={styles.page}>
            <View style={styles.content}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: theme.colors.primary + "20" }
                ]}
              >
                <IconSymbol
                  name={page.icon as any}
                  size={60}
                  color={theme.colors.primary}
                />
              </View>
              <Text
                style={[styles.title, { color: theme.colors.text.primary }]}
              >
                {page.title}
              </Text>
              <Text
                style={[
                  styles.description,
                  { color: theme.colors.text.secondary }
                ]}
              >
                {page.description}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {visiblePages.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => goToPage(index)}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentPage
                      ? theme.colors.primary
                      : theme.colors.text.secondary + "40",
                  width: index === currentPage ? 24 : 8
                }
              ]}
            />
          ))}
        </View>

        {isLastPage && (
          <TouchableOpacity
            onPress={handleDone}
            testID="tutorial-complete"
            accessibilityLabel="Complete tutorial"
            style={[
              styles.doneButton,
              { backgroundColor: theme.colors.primary }
            ]}
          >
            <Text
              style={[
                styles.doneButtonText,
                { color: theme.colors.background }
              ]}
            >
              Get Started
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    height: 60,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "flex-end"
  },
  skipButton: {
    padding: 10
  },
  skipButtonAndroid: {
    padding: 15,
    position: "relative",
    zIndex: 10
  },
  skipText: {
    fontSize: 16,
    fontWeight: "500"
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40
  },
  content: {
    alignItems: "center"
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20
  },
  footer: {
    paddingBottom: 40,
    paddingHorizontal: 20
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    gap: 8
  },
  dot: {
    height: 8,
    borderRadius: 4
  },
  doneButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: "center"
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: "600"
  }
})
