import { Ionicons } from "@expo/vector-icons"
import { Stack, useRouter } from "expo-router"
import React from "react"
import { TouchableOpacity } from "react-native"
import { useTheme } from "../../../context/ThemeContext"

// Back button component
const BackButton = () => {
  const router = useRouter()
  const { theme } = useTheme()
  return (
    <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
      <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
    </TouchableOpacity>
  )
}

export default function ServicesLayout() {
  const { theme } = useTheme()
  
  const screenOptions = {
    headerStyle: {
      backgroundColor: theme.colors.surface,
    },
    headerTintColor: theme.colors.text.primary,
    headerTitleStyle: {
      fontWeight: 'bold' as const,
      color: theme.colors.text.primary,
    },
  }
  
  return (
    <Stack screenOptions={screenOptions}>
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
        name="childcare"
        options={{
          headerLeft: () => <BackButton />,
          headerTitle: "Childcare Request",
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
