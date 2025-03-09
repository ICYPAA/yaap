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

export default function Hospitality() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    item: "",
    quantity: "",
    deliveryTime: "",
    allergies: "",
    notes: ""
  })

  const handleSubmit = () => {
    console.log("Submitting hospitality update:", form)
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: "Hospitality Update" }} />
      <Text style={styles.description}>
        Let everyone know when you're bringing food or supplies to the
        hospitality suite. This helps coordinate contributions and avoid
        duplicates.
      </Text>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Your name"
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
          <Text style={styles.label}>Item(s) Description</Text>
          <TextInput
            style={styles.input}
            value={form.item}
            onChangeText={(text) => setForm({ ...form, item: text })}
            placeholder="What are you bringing?"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={form.quantity}
            onChangeText={(text) => setForm({ ...form, quantity: text })}
            placeholder="How much are you bringing?"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Delivery Time</Text>
          <TextInput
            style={styles.input}
            value={form.deliveryTime}
            onChangeText={(text) => setForm({ ...form, deliveryTime: text })}
            placeholder="When will you deliver it?"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Allergy Information</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.allergies}
            onChangeText={(text) => setForm({ ...form, allergies: text })}
            placeholder="List any allergens (nuts, dairy, gluten, etc.)"
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.notes}
            onChangeText={(text) => setForm({ ...form, notes: text })}
            placeholder="Any other details we should know?"
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Update</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// Use the same styles as accessibility.tsx
