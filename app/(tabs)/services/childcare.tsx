import { Ionicons } from "@expo/vector-icons"
import { Stack, useRouter } from "expo-router"
import React, { useState } from "react"
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { useTheme } from "../../../context/ThemeContext"

interface ChildcareRequest {
  parentName: string
  email: string
  phone: string
  childName: string
  childAge: string
  specialNeeds: string
  eventDate: string
  startTime: string
  endTime: string
  additionalInfo: string
}

export default function ChildcareRequest() {
  const { theme } = useTheme()
  const router = useRouter()
  const styles = createStyles(theme)

  const [formData, setFormData] = useState<ChildcareRequest>({
    parentName: "",
    email: "",
    phone: "",
    childName: "",
    childAge: "",
    specialNeeds: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    additionalInfo: ""
  })

  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    // Validate required fields
    if (
      !formData.parentName ||
      !formData.email ||
      !formData.childName ||
      !formData.eventDate
    ) {
      Alert.alert("Required Fields", "Please fill in all required fields.")
      return
    }

    setLoading(true)

    try {
      // Here you would typically submit to your backend/Supabase
      // For now, we'll just show a success message
      Alert.alert(
        "Request Submitted",
        "Your childcare request has been submitted. We'll contact you within 24 hours with confirmation and details.",
        [{ text: "OK", onPress: () => resetForm() }]
      )
    } catch (error) {
      Alert.alert("Error", "Failed to submit request. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      parentName: "",
      email: "",
      phone: "",
      childName: "",
      childAge: "",
      specialNeeds: "",
      eventDate: "",
      startTime: "",
      endTime: "",
      additionalInfo: ""
    })
  }

  const updateField = (field: keyof ChildcareRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Childcare Request",
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

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Childcare Services</Text>
        <Text style={styles.infoText}>
          We provide safe, supervised childcare during conference events. Our
          volunteers are background-checked and experienced with children.
          Please submit your request at least 48 hours in advance.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parent Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Parent/Guardian Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.parentName}
            onChangeText={(value) => updateField("parentName", value)}
            placeholder="Your full name"
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(value) => updateField("email", value)}
            placeholder="your@email.com"
            placeholderTextColor={theme.colors.text.secondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={formData.phone}
            onChangeText={(value) => updateField("phone", value)}
            placeholder="(555) 123-4567"
            placeholderTextColor={theme.colors.text.secondary}
            keyboardType="phone-pad"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Child Information</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Child's Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.childName}
            onChangeText={(value) => updateField("childName", value)}
            placeholder="Child's full name"
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Child's Age</Text>
          <TextInput
            style={styles.input}
            value={formData.childAge}
            onChangeText={(value) => updateField("childAge", value)}
            placeholder="Age in years"
            placeholderTextColor={theme.colors.text.secondary}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Special Needs or Considerations</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.specialNeeds}
            onChangeText={(value) => updateField("specialNeeds", value)}
            placeholder="Any allergies, medical needs, behavioral considerations, etc."
            placeholderTextColor={theme.colors.text.secondary}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Childcare Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Event Date *</Text>
          <TextInput
            style={styles.input}
            value={formData.eventDate}
            onChangeText={(value) => updateField("eventDate", value)}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>Start Time</Text>
            <TextInput
              style={styles.input}
              value={formData.startTime}
              onChangeText={(value) => updateField("startTime", value)}
              placeholder="9:00 AM"
              placeholderTextColor={theme.colors.text.secondary}
            />
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>End Time</Text>
            <TextInput
              style={styles.input}
              value={formData.endTime}
              onChangeText={(value) => updateField("endTime", value)}
              placeholder="5:00 PM"
              placeholderTextColor={theme.colors.text.secondary}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Additional Information</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.additionalInfo}
            onChangeText={(value) => updateField("additionalInfo", value)}
            placeholder="Any other information we should know..."
            placeholderTextColor={theme.colors.text.secondary}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? "Submitting..." : "Submit Request"}
        </Text>
      </TouchableOpacity>

        <View style={styles.spacer} />
    </ScrollView>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.md
    },
    title: {
      ...theme.typography.h1,
      marginLeft: theme.spacing.md,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      margin: theme.spacing.lg,
      marginTop: 0,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      ...theme.shadows.small
    },
    infoTitle: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      fontWeight: "bold",
      marginBottom: theme.spacing.sm
    },
    infoText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      lineHeight: 20
    },
    section: {
      margin: theme.spacing.lg,
      marginTop: 0
    },
    sectionTitle: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      fontWeight: "bold",
      marginBottom: theme.spacing.lg
    },
    inputGroup: {
      marginBottom: theme.spacing.lg
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.text.primary,
      fontWeight: "600",
      marginBottom: theme.spacing.sm
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.md,
      ...theme.typography.body,
      color: theme.colors.text.primary
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top"
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between"
    },
    halfWidth: {
      width: "48%"
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
      margin: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      alignItems: "center",
      ...theme.shadows.small
    },
    submitButtonDisabled: {
      backgroundColor: theme.colors.text.secondary,
      opacity: 0.6
    },
    submitButtonText: {
      ...theme.typography.button,
      color: "#ffffff",
      fontWeight: "bold"
    },
    spacer: {
      height: theme.spacing.xl
    }
  })
