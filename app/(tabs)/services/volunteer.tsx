import { Stack } from "expo-router"
import React, { useState } from "react"
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { formStyles as styles } from "../../../styles/forms"

export default function Volunteer() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    availability: "",
    preferences: "",
    experience: "",
    tshirtSize: ""
  })

  const handleSubmit = () => {
    console.log("Submitting volunteer form:", form)
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: "Volunteer Sign Up" }} />
      <Text style={styles.description}>
        Help make ICYPAA happen! Sign up for greeting, setup, cleanup, or other
        service opportunities.
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
          <Text style={styles.label}>Availability</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.availability}
            onChangeText={(text) => setForm({ ...form, availability: text })}
            placeholder="When are you available to help?"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Service Preferences</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.preferences}
            onChangeText={(text) => setForm({ ...form, preferences: text })}
            placeholder="What type of service work interests you? (Greeting, Setup, Registration, etc.)"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Previous Service Experience</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.experience}
            onChangeText={(text) => setForm({ ...form, experience: text })}
            placeholder="Tell us about any previous service experience (optional)"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>T-Shirt Size</Text>
          <TextInput
            style={styles.input}
            value={form.tshirtSize}
            onChangeText={(text) => setForm({ ...form, tshirtSize: text })}
            placeholder="For volunteer t-shirt (S, M, L, XL, XXL, etc.)"
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Sign Up to Volunteer</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// Use the same styles as accessibility.tsx
