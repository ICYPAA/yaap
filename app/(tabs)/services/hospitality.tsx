import { withDeviceId } from "@/lib/supabase"
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
import { getStoredProgram, getTextColorForBackground } from "../../../lib/theme"
import { Program } from "../../../types/program"

export default function HospitalityUpdate() {
  const { theme, isDarkMode } = useTheme()
  const router = useRouter()
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [program, setProgram] = useState<Program | null>(null)
  const [description, setDescription] = useState<string>(
    "Let everyone know when you're bringing food or supplies to the hospitality suite!"
  )
  const [formErrors, setFormErrors] = useState<{
    groupName?: string
    itemDescription?: string
  }>({})

  const [form, setForm] = useState({
    groupName: "",
    itemDescription: "",
    allergies: "",
    notes: ""
  })

  useEffect(() => {
    const loadProgram = async () => {
      const storedProgram = await getStoredProgram()
      if (
        storedProgram &&
        storedProgram.content?.services?.hospitality?.internal_description
      ) {
        setProgram(storedProgram)
        setDescription(
          storedProgram.content.services.hospitality.internal_description
        )
      }
    }

    loadProgram()
  }, [])

  const validateForm = () => {
    const errors: {
      groupName?: string
      itemDescription?: string
    } = {}

    // Validate group name
    if (!form.groupName.trim()) {
      errors.groupName = "Group or individual name is required"
    }

    // Validate item description
    if (!form.itemDescription.trim()) {
      errors.itemDescription = "Item description is required"
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
        .from("hospitality_forms")
        .insert({
          program_id: 1, // Default to program ID 1
          group_name: form.groupName,
          item_description: form.itemDescription,
          allergies: form.allergies,
          notes: form.notes,
          status: "pending" // Set initial status to pending
        })

      if (error) {
        console.error("Error submitting hospitality update:", error)
        return
      }

      console.log("Successfully submitted hospitality update")

      // Send notification to host
      try {
        await sendNotification({
          eventType: "host",
          programId: 1,
          data: {
            type: "hospitality",
            group_name: form.groupName,
            item_description: form.itemDescription
          }
        })
        console.log("Sent host notification for hospitality update")
      } catch (notifyError) {
        console.error("Error sending host notification:", notifyError)
      }

      // Show success message
      setFormSubmitted(true)
    } catch (error) {
      console.error("Error submitting hospitality update:", error)
    }
  }

  const resetForm = () => {
    setForm({
      groupName: "",
      itemDescription: "",
      allergies: "",
      notes: ""
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
              program?.content?.services?.hospitality?.title ||
              "Hospitality Update",
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
            Thank you for your contribution!
          </Text>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.secondary,
              textAlign: "center",
              marginBottom: theme.spacing.xl
            }}
          >
            Your hospitality update has been submitted. The hospitality team
            will be notified.
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
              Submit Another Update
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
              program?.content?.services?.hospitality?.title ||
              "Hospitality Update",
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
              Group Name <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                borderWidth: 1,
                borderColor: formErrors.groupName
                  ? theme.colors.error
                  : theme.colors.border,
                color: theme.colors.text.primary
              }}
              value={form.groupName}
              onChangeText={(text) => {
                setForm({ ...form, groupName: text })
                if (formErrors.groupName) {
                  setFormErrors((prev) => ({ ...prev, groupName: undefined }))
                }
              }}
              placeholder="Your group name"
              placeholderTextColor={theme.colors.text.secondary}
            />
            {formErrors.groupName && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginTop: 4
                }}
              >
                {formErrors.groupName}
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
              Item Description{" "}
              <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                borderWidth: 1,
                borderColor: formErrors.itemDescription
                  ? theme.colors.error
                  : theme.colors.border,
                color: theme.colors.text.primary
              }}
              value={form.itemDescription}
              onChangeText={(text) => {
                setForm({ ...form, itemDescription: text })
                if (formErrors.itemDescription) {
                  setFormErrors((prev) => ({
                    ...prev,
                    itemDescription: undefined
                  }))
                }
              }}
              placeholder="Describe the item or food"
              placeholderTextColor={theme.colors.text.secondary}
            />
            {formErrors.itemDescription && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginTop: 4
                }}
              >
                {formErrors.itemDescription}
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
              Allergies/Dietary Restrictions
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
              value={form.allergies}
              onChangeText={(text) => setForm({ ...form, allergies: text })}
              placeholder="List any allergies or dietary restrictions"
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
              Additional Notes
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
              value={form.notes}
              onChangeText={(text) => setForm({ ...form, notes: text })}
              placeholder="Any additional information"
              placeholderTextColor={theme.colors.text.secondary}
              multiline
            />
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: theme.colors.primary,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              alignItems: "center",
              marginTop: theme.spacing.xl
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
              Submit Update
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// Use the same styles as accessibility.tsx
