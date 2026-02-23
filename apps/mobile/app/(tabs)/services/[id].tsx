import { Ionicons } from "@expo/vector-icons"
import { Stack, useRouter } from "expo-router"
import React from "react"
import { ScrollView, StyleSheet, TouchableOpacity } from "react-native"
import { theme } from "../../../constants/theme"

// Back button component
const BackButton = () => {
  const router = useRouter()
  return (
    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
      <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
    </TouchableOpacity>
  )
}

export default function ServicePage() {
  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          headerLeft: () => <BackButton />,
          headerTitle: "Service Details"
        }}
      />
      {/* Content will be specific to each service */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg
  },
  backButton: {
    padding: theme.spacing.sm
  }
})
