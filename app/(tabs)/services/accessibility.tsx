import { Ionicons } from "@expo/vector-icons"
import { Stack, useRouter } from "expo-router"
import React, { useState } from "react"
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../../../context/ThemeContext"
import { supabase } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

export default function AccessibilityRequest() {
  const { theme, isDarkMode } = useTheme()
  const router = useRouter()
  const [formSubmitted, setFormSubmitted] = useState(false)

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    needType: "",
    details: "",
    arrivalDate: "",
    duration: ""
  })

  const handleSubmit = async () => {
    try {
      // Submit form data to Supabase
      const { error } = await supabase.from("accessibility_forms").insert({
        program_id: 1, // Default to program ID 1
        name: form.name,
        phone: form.phone,
        email: form.email,
        need_type: form.needType,
        details: form.details,
        arrival_date: form.arrivalDate,
        duration: form.duration,
        status: "pending" // Set initial status to pending
      })

      if (error) {
        console.error("Error submitting accessibility request:", error)
        return
      }

      console.log("Successfully submitted accessibility request")
      // Show success message and reset form
      setFormSubmitted(true)
    } catch (error) {
      console.error("Error submitting accessibility request:", error)
    }
  }

  const resetForm = () => {
    setForm({
      name: "",
      phone: "",
      email: "",
      needType: "",
      details: "",
      arrivalDate: "",
      duration: ""
    })
    setFormSubmitted(false)
  }

  if (formSubmitted) {
    return (
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: theme.spacing.lg
        }}
      >
        <Stack.Screen
          options={{
            title: "Accessibility Request",
            headerStyle: {
              backgroundColor: theme.colors.background
            },
            headerTitleStyle: {
              color: theme.colors.text.primary
            },
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  padding: 8
                }}
              >
                <Ionicons
                  name="chevron-back"
                  size={28}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>
            )
          }}
        />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.md,
            padding: theme.spacing.xl,
            alignItems: "center",
            marginVertical: theme.spacing.xl
          }}
        >
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.primary,
              textAlign: "center",
              marginBottom: theme.spacing.md,
              fontWeight: "500"
            }}
          >
            Thank you for your request!
          </Text>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.secondary,
              textAlign: "center",
              marginBottom: theme.spacing.xl
            }}
          >
            Your accessibility request has been submitted. We'll be in touch
            shortly.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: theme.colors.primary,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              alignItems: "center"
            }}
            onPress={resetForm}
            activeOpacity={0.8}
          >
            <Text
              style={{
                ...theme.typography.body,
                color: getTextColorForBackground(theme.colors.primary),
                fontWeight: "500"
              }}
            >
              Submit Another Request
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing.lg
      }}
      contentContainerStyle={{ paddingBottom: theme.spacing.xl * 2 }}
    >
      <Stack.Screen
        options={{
          title: "Accessibility Request",
          headerStyle: {
            backgroundColor: theme.colors.background
          },
          headerTitleStyle: {
            color: theme.colors.text.primary
          },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                padding: 8
              }}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={theme.colors.text.secondary}
              />
            </TouchableOpacity>
          )
        }}
      />
      <Text
        style={{
          ...theme.typography.body,
          color: theme.colors.text.secondary,
          marginBottom: theme.spacing.xl
        }}
      >
        Request physical assistance, ASL interpreter, or language translation
        services for the conference.
      </Text>

      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.primary,
              fontWeight: "500"
            }}
          >
            Your Name
          </Text>
          <TextInput
            style={{
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              color: theme.colors.text.primary
            }}
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Enter your name"
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.primary,
              fontWeight: "500"
            }}
          >
            Phone Number
          </Text>
          <TextInput
            style={{
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              color: theme.colors.text.primary
            }}
            value={form.phone}
            onChangeText={(text) => setForm({ ...form, phone: text })}
            placeholder="Enter your phone number"
            placeholderTextColor={theme.colors.text.secondary}
            keyboardType="phone-pad"
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.primary,
              fontWeight: "500"
            }}
          >
            Email Address
          </Text>
          <TextInput
            style={{
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              color: theme.colors.text.primary
            }}
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            placeholder="Enter your email"
            placeholderTextColor={theme.colors.text.secondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.primary,
              fontWeight: "500"
            }}
          >
            Type of Accessibility Need
          </Text>
          <TextInput
            style={{
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              color: theme.colors.text.primary
            }}
            value={form.needType}
            onChangeText={(text) => setForm({ ...form, needType: text })}
            placeholder="E.g., Mobility, Hearing, etc."
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.primary,
              fontWeight: "500"
            }}
          >
            Details of Your Request
          </Text>
          <TextInput
            style={{
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              color: theme.colors.text.primary,
              minHeight: 100,
              textAlignVertical: "top"
            }}
            value={form.details}
            onChangeText={(text) => setForm({ ...form, details: text })}
            placeholder="Please provide details about your accessibility needs"
            placeholderTextColor={theme.colors.text.secondary}
            multiline
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.primary,
              fontWeight: "500"
            }}
          >
            Arrival Date
          </Text>
          <TextInput
            style={{
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              color: theme.colors.text.primary
            }}
            value={form.arrivalDate}
            onChangeText={(text) => setForm({ ...form, arrivalDate: text })}
            placeholder="When will you arrive?"
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.primary,
              fontWeight: "500"
            }}
          >
            Duration of Stay
          </Text>
          <TextInput
            style={{
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border,
              color: theme.colors.text.primary
            }}
            value={form.duration}
            onChangeText={(text) => setForm({ ...form, duration: text })}
            placeholder="How long will you be staying?"
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: theme.colors.primary,
            padding: theme.spacing.md,
            borderRadius: theme.borderRadius.sm,
            alignItems: "center",
            marginTop: theme.spacing.md
          }}
          onPress={handleSubmit}
          activeOpacity={0.8}
        >
          <Text
            style={{
              ...theme.typography.body,
              color: getTextColorForBackground(theme.colors.primary),
              fontWeight: "500"
            }}
          >
            Submit Request
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
