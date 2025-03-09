import { Ionicons } from "@expo/vector-icons"
import { Stack, useRouter } from "expo-router"
import React from "react"
import { TouchableOpacity } from "react-native"
import { theme } from "../../../constants/theme"

// Back button component
const BackButton = () => {
  const router = useRouter()
  return (
    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
      <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
    </TouchableOpacity>
  )
}

export default function ServicesLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false
        }}
      />
      <Stack.Screen
        name="accessibility"
        options={{
          headerLeft: () => <BackButton />,
          headerTitle: "Request Assistance",
          headerShown: true
        }}
      />
      <Stack.Screen
        name="ride"
        options={{
          headerLeft: () => <BackButton />,
          headerTitle: "Request a Ride",
          headerShown: true
        }}
      />
      <Stack.Screen
        name="volunteer"
        options={{
          headerLeft: () => <BackButton />,
          headerTitle: "Volunteer Sign Up",
          headerShown: true
        }}
      />
      <Stack.Screen
        name="hospitality"
        options={{
          headerLeft: () => <BackButton />,
          headerTitle: "Hospitality Update",
          headerShown: true
        }}
      />
      <Stack.Screen
        name="support"
        options={{
          headerLeft: () => <BackButton />,
          headerTitle: "Support Chat",
          headerShown: true
        }}
      />
      <Stack.Screen
        name="host"
        options={{
          headerLeft: () => <BackButton />,
          headerTitle: "Host Login",
          headerShown: true
        }}
      />
    </Stack>
  )
}
