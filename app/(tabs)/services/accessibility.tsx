import { Ionicons } from "@expo/vector-icons"
import { Stack, useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../../../context/ThemeContext"
import { sendNotification } from "../../../lib/notificationHelper"
import { withDeviceId } from "../../../lib/supabase"
import { getStoredProgram, getTextColorForBackground } from "../../../lib/theme"
import { Program } from "../../../types/program"

export default function AccessibilityRequest() {
  const { theme, isDarkMode } = useTheme()
  const router = useRouter()
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [program, setProgram] = useState<Program | null>(null)
  const [description, setDescription] = useState<string>(
    "Request physical assistance, ASL interpreter, or language translation services for the conference."
  )
  const [formErrors, setFormErrors] = useState<{
    name?: string
    phone?: string
    email?: string
    needType?: string
    arrivalDate?: string
    duration?: string
  }>({})

  useEffect(() => {
    const loadProgram = async () => {
      const storedProgram = await getStoredProgram()
      if (
        storedProgram &&
        storedProgram.content?.services?.accessibility?.internal_description
      ) {
        setProgram(storedProgram)
        setDescription(
          storedProgram.content.services.accessibility.internal_description
        )
      }
    }

    loadProgram()
  }, [])

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    needType: "",
    details: "",
    arrivalDate: "",
    duration: ""
  })

  const validateForm = () => {
    const errors: {
      name?: string
      phone?: string
      email?: string
      needType?: string
      arrivalDate?: string
      duration?: string
    } = {}

    // Validate name
    if (!form.name.trim()) {
      errors.name = "Name is required"
    }

    // Validate phone
    if (!form.phone.trim()) {
      errors.phone = "Phone number is required"
    }

    // Validate email
    if (!form.email.trim()) {
      errors.email = "Email address is required"
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      errors.email = "Please enter a valid email address"
    }

    // Validate need type
    if (!form.needType.trim()) {
      errors.needType = "Type of need is required"
    }

    // Validate arrival date
    if (!form.arrivalDate.trim()) {
      errors.arrivalDate = "Arrival date is required"
    }

    // Validate duration
    if (!form.duration.trim()) {
      errors.duration = "Duration of stay is required"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    // Validate form before submission
    if (!validateForm()) {
      return
    }

    try {
      // Submit form data to Supabase
      const supabaseWithDeviceId = await withDeviceId()
      const { error } = await supabaseWithDeviceId
        .from("accessibility_forms")
        .insert({
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

      // Send notification to host
      try {
        await sendNotification({
          eventType: "host",
          programId: 1,
          data: {
            type: "accessibility",
            name: form.name,
            details: form.details?.substring(0, 100)
          }
        })
        console.log("Sent host notification for accessibility request")
      } catch (notifyError) {
        console.error("Error sending host notification:", notifyError)
      }

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
            title:
              program?.content?.services?.accessibility?.title ||
              "Accessibility Request",
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: theme.spacing.lg
        }}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl * 3 }}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen
          options={{
            title:
              program?.content?.services?.accessibility?.title ||
              "Accessibility Request",
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
          {description}
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
              Your Name <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                borderWidth: 1,
                borderColor: formErrors.name
                  ? theme.colors.error
                  : theme.colors.border,
                color: theme.colors.text.primary
              }}
              value={form.name}
              onChangeText={(text) => {
                setForm({ ...form, name: text })
                if (formErrors.name) {
                  setFormErrors((prev) => ({ ...prev, name: undefined }))
                }
              }}
              placeholder="Enter your name"
              placeholderTextColor={theme.colors.text.secondary}
            />
            {formErrors.name && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginTop: 4
                }}
              >
                {formErrors.name}
              </Text>
            )}
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Phone Number <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                borderWidth: 1,
                borderColor: formErrors.phone
                  ? theme.colors.error
                  : theme.colors.border,
                color: theme.colors.text.primary
              }}
              value={form.phone}
              onChangeText={(text) => {
                setForm({ ...form, phone: text })
                if (formErrors.phone) {
                  setFormErrors((prev) => ({ ...prev, phone: undefined }))
                }
              }}
              placeholder="Enter your phone number"
              placeholderTextColor={theme.colors.text.secondary}
              keyboardType="phone-pad"
            />
            {formErrors.phone && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginTop: 4
                }}
              >
                {formErrors.phone}
              </Text>
            )}
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Email Address <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                borderWidth: 1,
                borderColor: formErrors.email
                  ? theme.colors.error
                  : theme.colors.border,
                color: theme.colors.text.primary
              }}
              value={form.email}
              onChangeText={(text) => {
                setForm({ ...form, email: text })
                if (formErrors.email) {
                  setFormErrors((prev) => ({ ...prev, email: undefined }))
                }
              }}
              placeholder="Enter your email"
              placeholderTextColor={theme.colors.text.secondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {formErrors.email && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginTop: 4
                }}
              >
                {formErrors.email}
              </Text>
            )}
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Type of Accessibility Need{" "}
              <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                borderWidth: 1,
                borderColor: formErrors.needType
                  ? theme.colors.error
                  : theme.colors.border,
                color: theme.colors.text.primary
              }}
              value={form.needType}
              onChangeText={(text) => {
                setForm({ ...form, needType: text })
                if (formErrors.needType) {
                  setFormErrors((prev) => ({ ...prev, needType: undefined }))
                }
              }}
              placeholder="E.g., Mobility, Hearing, etc."
              placeholderTextColor={theme.colors.text.secondary}
            />
            {formErrors.needType && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginTop: 4
                }}
              >
                {formErrors.needType}
              </Text>
            )}
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
              Arrival Date <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                borderWidth: 1,
                borderColor: formErrors.arrivalDate
                  ? theme.colors.error
                  : theme.colors.border,
                color: theme.colors.text.primary
              }}
              value={form.arrivalDate}
              onChangeText={(text) => {
                setForm({ ...form, arrivalDate: text })
                if (formErrors.arrivalDate) {
                  setFormErrors((prev) => ({ ...prev, arrivalDate: undefined }))
                }
              }}
              placeholder="When will you arrive?"
              placeholderTextColor={theme.colors.text.secondary}
            />
            {formErrors.arrivalDate && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginTop: 4
                }}
              >
                {formErrors.arrivalDate}
              </Text>
            )}
          </View>

          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Duration of Stay{" "}
              <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                borderWidth: 1,
                borderColor: formErrors.duration
                  ? theme.colors.error
                  : theme.colors.border,
                color: theme.colors.text.primary
              }}
              value={form.duration}
              onChangeText={(text) => {
                setForm({ ...form, duration: text })
                if (formErrors.duration) {
                  setFormErrors((prev) => ({ ...prev, duration: undefined }))
                }
              }}
              placeholder="How long will you be staying?"
              placeholderTextColor={theme.colors.text.secondary}
            />
            {formErrors.duration && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginTop: 4
                }}
              >
                {formErrors.duration}
              </Text>
            )}
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
    </KeyboardAvoidingView>
  )
}
