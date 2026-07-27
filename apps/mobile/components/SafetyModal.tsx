import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import React, { useEffect, useState } from "react"
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Linking as RNLinking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../context/ThemeContext"

interface SafetyModalProps {
  visible: boolean
  onClose: () => void
  isInitialView?: boolean
}

const SAFETY_VIEWED_KEY = "safety_statement_viewed"

export const SafetyModal: React.FC<SafetyModalProps> = ({
  visible,
  onClose,
  isInitialView = false
}) => {
  const { theme } = useTheme()
  const [hasBeenViewed, setHasBeenViewed] = useState(false)

  useEffect(() => {
    checkIfViewed()
  }, [])

  const checkIfViewed = async () => {
    try {
      const viewed = await AsyncStorage.getItem(SAFETY_VIEWED_KEY)
      setHasBeenViewed(viewed === "true")
    } catch (error) {
      console.error("Error checking safety viewed status:", error)
    }
  }

  const handleClose = async () => {
    try {
      if (isInitialView && !hasBeenViewed) {
        await AsyncStorage.setItem(SAFETY_VIEWED_KEY, "true")
        setHasBeenViewed(true)
      }
      onClose()
    } catch (error) {
      console.error("Error saving safety viewed status:", error)
      onClose()
    }
  }

  const openPolicyLink = () => {
    RNLinking.openURL("https://icypaa.org/ndahp.pdf")
  }

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center"
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      margin: 20,
      maxHeight: Platform.OS === "android" ? "80%" : "85%",
      width: "90%",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5
    },
    modalContentAndroid: {
      flex: 1,
      display: "flex",
      flexDirection: "column"
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      flex: 1
    },
    closeButton: {
      padding: 4
    },
    scrollContent: {
      flex: Platform.OS === "android" ? 1 : undefined
    },
    scrollContentInner: {
      padding: 20,
      paddingBottom: Platform.OS === "android" ? 30 : 20,
      flexGrow: Platform.OS === "ios" ? 1 : undefined
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text.primary,
      marginTop: 20,
      marginBottom: 12
    },
    firstSectionTitle: {
      marginTop: 0
    },
    bodyText: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text.secondary,
      marginBottom: 12
    },
    italicText: {
      fontStyle: "italic",
      fontSize: 14,
      color: theme.colors.text.secondary,
      marginBottom: 12
    },
    linkButton: {
      marginTop: 8,
      marginBottom: 16
    },
    linkText: {
      color: theme.colors.primary,
      fontSize: 15,
      textDecorationLine: "underline"
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      position: Platform.OS === "android" ? "relative" : undefined,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16
    },
    acknowledgeButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: "center"
    },
    acknowledgeButtonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600"
    },
    safetyIcon: {
      marginBottom: 12,
      alignSelf: "center"
    }
  })

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.modalContent,
            Platform.OS === "android" && styles.modalContentAndroid
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Safety & Anonymity</Text>
            {!isInitialView && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={Platform.OS === "android"}
            contentContainerStyle={styles.scrollContentInner}
          >
            <View style={styles.safetyIcon}>
              <Ionicons
                name="shield-checkmark"
                size={48}
                color={theme.colors.primary}
              />
            </View>

            <Text style={[styles.sectionTitle, styles.firstSectionTitle]}>
              Statement of Safety
            </Text>
            <Text style={styles.italicText}>
              *Service Material from the General Service Office*
            </Text>
            <Text style={styles.bodyText}>
              Our group endeavors to provide a safe meeting place for all
              attendees and encourages each person here to foster a secure and
              welcoming environment in which our meetings can take place. As our
              Traditions remind us, the formation and operation of an A.A. group
              resides within the group conscience.
            </Text>
            <Text style={styles.bodyText}>
              Therefore, we ask that group members and others refrain from any
              behavior that might compromise another person's safety. Also,
              please take the precautions you feel are necessary to ensure your
              own personal safety.
            </Text>
            <Text style={styles.bodyText}>
              If a situation should arise where someone feels their safety is in
              jeopardy, or the situation breaches the law, the individuals
              involved should take appropriate action. Calling the proper
              authorities does not go against any A.A. Traditions and is
              recommended when someone may have broken the law or endangered the
              safety of another person.
            </Text>

            <Text style={styles.sectionTitle}>Anti-Harassment Policy</Text>
            <Text style={styles.bodyText}>
              ICYPAA expressly prohibits any form of harassment or sexual
              harassment by or against any Advisory Council members, Host
              Committee members, Bid Committee members, attendees of the annual
              conference events, and all participants in ICYPAA-operated or
              -moderated websites, Internet forums or social media pages.
            </Text>

            <Text style={styles.sectionTitle}>Anti-Discrimination Policy</Text>
            <Text style={styles.bodyText}>
              ICYPAA expressly prohibits any form of discrimination by or
              against its Advisory Council members, Host Committee Members, or
              attendees of the annual conference or events, and all participants
              in ICYPAA operated or moderated websites, Internet forums, or
              social media pages based on age, race, color, religion, sex,
              national origin, creed, disability, veteran's status, sexual
              orientation, gender identity or gender expression.
            </Text>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={openPolicyLink}
            >
              <Text style={styles.linkText}>View full NDAH Policy (PDF)</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Your Privacy</Text>
            <Text style={styles.bodyText}>
              This app is designed with your anonymity in mind. We collect
              minimal personal information and you have full control over what
              you share. Your safety and privacy are our top priorities.
            </Text>

            <Text style={styles.sectionTitle}>
              Need Help or Want to Report Something?
            </Text>
            <Text style={styles.bodyText}>
              If you need assistance or need to report a safety concern:
            </Text>
            <View style={{ marginLeft: 16, marginBottom: 12 }}>
              <Text style={[styles.bodyText, { marginBottom: 8 }]}>
                • Check our <Text style={{ fontWeight: "600" }}>Safety</Text> in
                the tab for more information
              </Text>
              {/* <Text style={[styles.bodyText, { marginBottom: 8 }]}>
                • Use the{" "}
                <Text style={{ fontWeight: "600" }}>Support Chat</Text> in the
                Services section of the app
              </Text>
              <Text style={[styles.bodyText, { marginBottom: 8 }]}>
                • Contact any{" "}
                <Text style={{ fontWeight: "600" }}>Host Committee member</Text>
                ; they can be identified by their host shirts
              </Text> */}
              <Text style={[styles.bodyText, { marginBottom: 8 }]}>
                • In case of emergency, don't hesitate to contact local
                authorities
              </Text>
            </View>
            <Text
              style={[
                styles.bodyText,
                {
                  fontStyle: "italic",
                  marginBottom: Platform.OS === "android" ? 20 : 12
                }
              ]}
            >
              Remember: Your safety is our priority. Speaking up about safety
              concerns is encouraged and supported.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.acknowledgeButton}
              onPress={handleClose}
              testID="safety-acknowledge"
              accessibilityLabel={
                isInitialView ? "Acknowledge safety statement" : "Close safety statement"
              }
            >
              <Text style={styles.acknowledgeButtonText}>
                {isInitialView ? "I Understand" : "Close"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// Hook to check if safety statement should be shown
export const useSafetyModal = () => {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    checkSafetyStatus()
  }, [])

  const checkSafetyStatus = async () => {
    try {
      const viewed = await AsyncStorage.getItem(SAFETY_VIEWED_KEY)
      setShouldShow(viewed !== "true")
    } catch (error) {
      console.error("Error checking safety status:", error)
      setShouldShow(false)
    }
  }

  const markAsViewed = async () => {
    try {
      await AsyncStorage.setItem(SAFETY_VIEWED_KEY, "true")
      setShouldShow(false)
    } catch (error) {
      console.error("Error marking safety as viewed:", error)
    }
  }

  return { shouldShow, markAsViewed }
}
