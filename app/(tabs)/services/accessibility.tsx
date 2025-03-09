import React, { useState } from "react"
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { theme } from "../../../constants/theme"

export default function AccessibilityRequest() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    needType: "",
    details: "",
    arrivalDate: "",
    duration: ""
  })

  const handleSubmit = () => {
    // Submit form data to backend
    console.log("Submitting accessibility request:", form)
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.description}>
        Request physical assistance, ASL interpreter, or language translation
        services for the conference.
      </Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Your full name"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={form.phone}
            onChangeText={(text) => setForm({ ...form, phone: text })}
            placeholder="Your contact number"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            placeholder="Your email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type of Assistance Needed</Text>
          <TextInput
            style={styles.input}
            value={form.needType}
            onChangeText={(text) => setForm({ ...form, needType: text })}
            placeholder="Physical assistance, ASL, translation, etc."
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Additional Details</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.details}
            onChangeText={(text) => setForm({ ...form, details: text })}
            placeholder="Please provide any specific details about your needs"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Arrival Date</Text>
          <TextInput
            style={styles.input}
            value={form.arrivalDate}
            onChangeText={(text) => setForm({ ...form, arrivalDate: text })}
            placeholder="When will you arrive?"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Duration of Need</Text>
          <TextInput
            style={styles.input}
            value={form.duration}
            onChangeText={(text) => setForm({ ...form, duration: text })}
            placeholder="How long will you need assistance?"
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Request</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xl
  },
  form: {
    gap: theme.spacing.lg
  },
  inputGroup: {
    gap: theme.spacing.xs
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
    fontWeight: "500"
  },
  input: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top"
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    marginTop: theme.spacing.lg
  },
  submitButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: "500"
  }
})
