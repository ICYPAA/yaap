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

export default function RideRequest() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    pickup: "",
    dropoff: "",
    datetime: "",
    passengers: "",
    notes: ""
  })

  const handleSubmit = () => {
    // Submit form data to backend
    console.log("Submitting ride request:", form)
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: "Request a Ride" }} />
      <Text style={styles.description}>
        Request a ride within 30 miles of the conference venue. Local members
        will be notified and can offer assistance.
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
          <Text style={styles.label}>Pickup Location</Text>
          <TextInput
            style={styles.input}
            value={form.pickup}
            onChangeText={(text) => setForm({ ...form, pickup: text })}
            placeholder="Where should we pick you up?"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Dropoff Location</Text>
          <TextInput
            style={styles.input}
            value={form.dropoff}
            onChangeText={(text) => setForm({ ...form, dropoff: text })}
            placeholder="Where are you going?"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date & Time</Text>
          <TextInput
            style={styles.input}
            value={form.datetime}
            onChangeText={(text) => setForm({ ...form, datetime: text })}
            placeholder="When do you need the ride?"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Number of Passengers</Text>
          <TextInput
            style={styles.input}
            value={form.passengers}
            onChangeText={(text) => setForm({ ...form, passengers: text })}
            placeholder="How many people need a ride?"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes}
            onChangeText={(text) => setForm({ ...form, notes: text })}
            placeholder="Any additional details we should know?"
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Request</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// Use the same styles as accessibility.tsx
