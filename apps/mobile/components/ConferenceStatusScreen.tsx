import { Ionicons } from "@expo/vector-icons"
import React from "react"
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useCurrentConference } from "../context/CurrentConferenceContext"
import { useTheme } from "../context/ThemeContext"
import {
  formatConferenceProgramDate,
  resolveConferenceTimeZone
} from "../lib/conferenceTime"
import { Program } from "../types/program"

const formatDateRange = (program: Program | null) => {
  if (!program) return null
  const timeZone = resolveConferenceTimeZone(program)
  const start = formatConferenceProgramDate(program.start_date, timeZone)
  const end = formatConferenceProgramDate(program.end_date, timeZone)
  if (start && end) return start === end ? start : `${start} - ${end}`
  return start || end
}

const formatLocation = (program: Program | null) => {
  const location = program?.location
  if (!location) return null
  const cityState = [location.address?.city, location.address?.state]
    .filter(Boolean)
    .join(", ")
  return [location.name, cityState].filter(Boolean).join(" • ")
}

export const ConferenceStatusScreen = () => {
  const { theme } = useTheme()
  const { status, program, loading, refresh } = useCurrentConference()
  const styles = createStyles(theme)
  const dateRange = formatDateRange(program)
  const location = formatLocation(program)
  const isPlanning = status === "planning" && program

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {isPlanning && program.logo ? (
          <Image source={{ uri: program.logo }} style={styles.logo} />
        ) : (
          <View style={styles.iconShell}>
            <Ionicons
              name={isPlanning ? "calendar-outline" : "time-outline"}
              size={42}
              color={theme.colors.primary}
            />
          </View>
        )}

        <Text style={styles.title}>
          {isPlanning ? program.title : "No conference is currently available"}
        </Text>

        {isPlanning ? (
          <>
            {dateRange ? <Text style={styles.meta}>{dateRange}</Text> : null}
            {location ? <Text style={styles.meta}>{location}</Text> : null}
            <Text style={styles.body}>
              Conference details are being prepared. The full program will be
              available when the conference is active.
            </Text>
          </>
        ) : (
          <Text style={styles.body}>
            Check back later for the next conference program.
          </Text>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={refresh}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color="#ffffff" />
              <Text style={styles.buttonText}>Refresh</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
      gap: theme.spacing.md
    },
    logo: {
      width: 160,
      height: 160,
      resizeMode: "contain",
      marginBottom: theme.spacing.sm
    },
    iconShell: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border
    },
    title: {
      ...theme.typography.h1,
      color: theme.colors.text.primary,
      textAlign: "center",
      fontWeight: "bold"
    },
    meta: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center"
    },
    body: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center",
      marginTop: theme.spacing.sm,
      lineHeight: 24
    },
    button: {
      minHeight: 48,
      minWidth: 128,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg
    },
    buttonText: {
      color: "#ffffff",
      fontWeight: "700"
    }
  })
