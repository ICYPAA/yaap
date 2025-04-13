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

export default function HospitalityUpdate() {
  const { theme } = useTheme()
  const router = useRouter()
  const [formSubmitted, setFormSubmitted] = useState(false)

  const [form, setForm] = useState({
    groupName: "",
    itemDescription: "",
    allergies: "",
    notes: ""
  })

  const handleSubmit = async () => {
    try {
      // Submit form data to Supabase
      const { error } = await supabase.from("hospitality_forms").insert({
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
            title: "Hospitality Update",
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
          title: "Hospitality Update",
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
        Update items for the hospitality suite or notify organizers.
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
            Group Name
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
            value={form.groupName}
            onChangeText={(text) => setForm({ ...form, groupName: text })}
            placeholder="Your group name"
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
            Item Description
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
            value={form.itemDescription}
            onChangeText={(text) => setForm({ ...form, itemDescription: text })}
            placeholder="Describe the item or food"
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
  )
}

// Use the same styles as accessibility.tsx
