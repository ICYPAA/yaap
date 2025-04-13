import { Ionicons } from "@expo/vector-icons"
import DateTimePicker from "@react-native-community/datetimepicker"
import { Stack, useRouter } from "expo-router"
import React, { useState } from "react"
import {
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { Dropdown } from "react-native-element-dropdown"
import { useTheme } from "../../../context/ThemeContext"
import { supabase } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

type DestinationOption = {
  label: string
  value: "venue" | "home"
}

export default function RideRequest() {
  const { theme, isDarkMode } = useTheme()
  const router = useRouter()
  const [formSubmitted, setFormSubmitted] = useState(false)

  const destinationOptions: DestinationOption[] = [
    { label: "To Venue", value: "venue" },
    { label: "To Home/Hotel", value: "home" }
  ]

  const [form, setForm] = useState({
    name: "",
    phone: "",
    location: "",
    destination: "venue" as "venue" | "home", // Default to venue
    datetime: new Date(), // Default to current time
    passengers: "",
    notes: ""
  })

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || form.datetime

    if (Platform.OS === "android") {
      // On Android, dismiss events have type undefined
      setShowDatePicker(false)

      // Only update if a date was actually selected
      if (selectedDate) {
        // Keep the time part of the current datetime
        const updatedDate = new Date(currentDate)
        updatedDate.setHours(
          form.datetime.getHours(),
          form.datetime.getMinutes()
        )

        setForm({ ...form, datetime: updatedDate })
        // Show time picker after date is selected on Android
        setTimeout(() => setShowTimePicker(true), 100)
      }
    } else {
      // For iOS, we just update the date without hiding the picker
      if (selectedDate) {
        // Keep the time part of the current datetime
        const updatedDate = new Date(currentDate)
        updatedDate.setHours(
          form.datetime.getHours(),
          form.datetime.getMinutes()
        )

        setForm({ ...form, datetime: updatedDate })
      }
    }
  }

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false)

      // Only update if a time was actually selected
      if (selectedTime) {
        // Keep the date part of the current datetime
        const newDate = new Date(form.datetime)
        newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes())

        setForm({ ...form, datetime: newDate })
      }
    } else {
      // For iOS, we just update the time without hiding the picker
      if (selectedTime) {
        // Keep the date part of the current datetime
        const newDate = new Date(form.datetime)
        newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes())

        setForm({ ...form, datetime: newDate })
      }
    }
  }

  const showDatepicker = () => {
    // Hide time picker first if it's showing
    setShowTimePicker(false)
    setShowDatePicker(true)
  }

  const showTimepicker = () => {
    setShowDatePicker(false)
    setShowTimePicker(true)
  }

  const handleSubmit = async () => {
    try {
      // Parse the passengers field to an integer
      const passengersInt = parseInt(form.passengers) || 1

      // Submit form data to Supabase
      const { error } = await supabase.from("ride_forms").insert({
        program_id: 1, // Default to program ID 1
        name: form.name,
        phone: form.phone,
        location: form.location,
        destination: form.destination,
        datetime: form.datetime.toISOString(),
        passengers: passengersInt,
        notes: form.notes,
        status: "pending" // Set initial status to pending
      })

      if (error) {
        console.error("Error submitting ride request:", error)
        return
      }

      console.log("Successfully submitted ride request")
      // Show success message
      setFormSubmitted(true)
    } catch (error) {
      console.error("Error submitting ride request:", error)
    }
  }

  const resetForm = () => {
    setForm({
      name: "",
      phone: "",
      location: "",
      destination: "venue" as "venue" | "home",
      datetime: new Date(),
      passengers: "",
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
            title: "Request a Ride",
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
            Your ride request has been submitted!
          </Text>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.secondary,
              textAlign: "center",
              marginBottom: theme.spacing.xl
            }}
          >
            We've received your request and local members will be notified.
            Someone will be in touch with you shortly.
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
          title: "Request a Ride",
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
        Request a ride within 30 miles of the conference venue. Local members
        will be notified and can offer assistance.
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
            placeholder="Your full name"
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
            placeholder="Your contact number"
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
            Location
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
            value={form.location}
            onChangeText={(text) => setForm({ ...form, location: text })}
            placeholder="Where should we pick you up?"
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
            Destination
          </Text>
          <Dropdown
            style={{
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border
            }}
            data={destinationOptions}
            labelField="label"
            valueField="value"
            placeholder="Select destination"
            placeholderStyle={{ color: theme.colors.text.secondary }}
            selectedTextStyle={{ color: theme.colors.text.primary }}
            value={form.destination}
            onChange={(item: DestinationOption) =>
              setForm({ ...form, destination: item.value })
            }
            activeColor={theme.colors.surface}
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
            Date & Time
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border
            }}
            onPress={showDatepicker}
          >
            <Text style={{ color: theme.colors.text.primary }}>
              {form.datetime.toLocaleString()}
            </Text>
          </TouchableOpacity>

          {showDatePicker && Platform.OS === "android" && (
            <DateTimePicker
              testID="dateTimePicker"
              value={form.datetime}
              mode="date"
              display="default"
              onChange={handleDateChange}
              themeVariant={isDarkMode ? "dark" : "light"}
            />
          )}

          {showTimePicker && Platform.OS === "android" && (
            <DateTimePicker
              testID="timeTimePicker"
              value={form.datetime}
              mode="time"
              display="default"
              onChange={handleTimeChange}
              themeVariant={isDarkMode ? "dark" : "light"}
            />
          )}

          {Platform.OS === "ios" && (
            <View>
              {showDatePicker && (
                <View>
                  <DateTimePicker
                    testID="dateTimePicker"
                    value={form.datetime}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    themeVariant={isDarkMode ? "dark" : "light"}
                    style={{ height: 180, marginTop: 10 }}
                  />

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 10
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        backgroundColor: theme.colors.surface,
                        padding: theme.spacing.sm,
                        borderRadius: theme.borderRadius.sm,
                        borderWidth: 1,
                        borderColor: theme.colors.border
                      }}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={{ color: theme.colors.text.primary }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        backgroundColor: theme.colors.primary,
                        padding: theme.spacing.sm,
                        borderRadius: theme.borderRadius.sm
                      }}
                      onPress={showTimepicker}
                    >
                      <Text
                        style={{
                          color: getTextColorForBackground(theme.colors.primary)
                        }}
                      >
                        Select Time
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {showTimePicker && (
                <View>
                  <DateTimePicker
                    testID="timeTimePicker"
                    value={form.datetime}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    themeVariant={isDarkMode ? "dark" : "light"}
                    style={{ height: 180, marginTop: 10 }}
                  />

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 10
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        backgroundColor: theme.colors.surface,
                        padding: theme.spacing.sm,
                        borderRadius: theme.borderRadius.sm,
                        borderWidth: 1,
                        borderColor: theme.colors.border
                      }}
                      onPress={showDatepicker}
                    >
                      <Text style={{ color: theme.colors.text.primary }}>
                        Back to Date
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        backgroundColor: theme.colors.primary,
                        padding: theme.spacing.sm,
                        borderRadius: theme.borderRadius.sm
                      }}
                      onPress={() => setShowTimePicker(false)}
                    >
                      <Text
                        style={{
                          color: getTextColorForBackground(theme.colors.primary)
                        }}
                      >
                        Done
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
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
            Number of Passengers
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
            value={form.passengers}
            onChangeText={(text) => setForm({ ...form, passengers: text })}
            placeholder="How many people need a ride?"
            placeholderTextColor={theme.colors.text.secondary}
            keyboardType="number-pad"
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
            placeholder="Any additional information we should know"
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
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.xl
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
