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
import { ProtectedComponent } from "../../../components/ProtectedComponent"
import { useTheme } from "../../../context/ThemeContext"
import { sendNotification } from "../../../lib/notificationHelper"
import { withDeviceId } from "../../../lib/supabase"
import { getStoredProgram, getTextColorForBackground } from "../../../lib/theme"
import { Program } from "../../../types/program"

// Define the volunteer interest form data structure
type VolunteerInterestFormData = {
  name: string
  lastInitial: string
  phone: string
  email: string
  interests: {
    greeter: boolean
    security: boolean
    cleanup: boolean
    merch: boolean
    registration: boolean
    wherever: boolean
  }
  timeSlots: {
    thursdayPM: boolean
    fridayAM: boolean
    fridayMidday: boolean
    fridayPM: boolean
    saturdayAM: boolean
    saturdayMidday: boolean
    saturdayPM: boolean
    sundayAM: boolean
    sundayMidday: boolean
    sundayPM: boolean
    other: string
  }
  comments: string
}

export default function VolunteerSignup() {
  const { theme, isDarkMode } = useTheme()
  const router = useRouter()
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [program, setProgram] = useState<Program | null>(null)
  const [description, setDescription] = useState<string>(
    "Help make ICYPAA happen! Sign up for greeting, setup, cleanup, or other service opportunities."
  )
  const [formErrors, setFormErrors] = useState<{
    name?: string
    lastInitial?: string
    phone?: string
    email?: string
    interests?: string
    timeSlots?: string
  }>({})

  const [formData, setFormData] = useState<VolunteerInterestFormData>({
    name: "",
    lastInitial: "",
    phone: "",
    email: "",
    interests: {
      greeter: false,
      security: false,
      cleanup: false,
      merch: false,
      registration: false,
      wherever: false
    },
    timeSlots: {
      thursdayPM: false,
      fridayAM: false,
      fridayMidday: false,
      fridayPM: false,
      saturdayAM: false,
      saturdayMidday: false,
      saturdayPM: false,
      sundayAM: false,
      sundayMidday: false,
      sundayPM: false,
      other: ""
    },
    comments: ""
  })

  useEffect(() => {
    const loadProgram = async () => {
      const storedProgram = await getStoredProgram()
      if (
        storedProgram &&
        storedProgram.content?.services?.volunteering?.internal_description
      ) {
        setProgram(storedProgram)
        setDescription(
          storedProgram.content.services.volunteering.internal_description
        )
      }
    }

    loadProgram()
  }, [])

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }))
  }

  const handleInterestChange = (
    interest: keyof VolunteerInterestFormData["interests"],
    checked: boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      interests: {
        ...prev.interests,
        [interest]: checked
      }
    }))
  }

  const handleTimeSlotChange = (
    timeSlot: keyof VolunteerInterestFormData["timeSlots"],
    value: boolean | string
  ) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: {
        ...prev.timeSlots,
        [timeSlot]: value
      }
    }))
  }

  const validateForm = () => {
    const errors: {
      name?: string
      lastInitial?: string
      phone?: string
      email?: string
      interests?: string
      timeSlots?: string
    } = {}

    // Validate name
    if (!formData.name.trim()) {
      errors.name = "Name is required"
    }

    // Validate last initial
    if (!formData.lastInitial.trim()) {
      errors.lastInitial = "Last initial is required"
    }

    // Validate phone
    if (!formData.phone.trim()) {
      errors.phone = "Phone number is required"
    }

    // Validate email
    if (!formData.email.trim()) {
      errors.email = "Email address is required"
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address"
    }

    // Check if at least one interest is selected
    const hasInterest = Object.values(formData.interests).some(
      (value) => value === true
    )
    if (!hasInterest) {
      errors.interests = "Please select at least one volunteer interest"
    }

    // Check if at least one time slot is selected
    const hasTimeSlot = Object.entries(formData.timeSlots)
      .filter(([key]) => key !== "other")
      .some(([_, value]) => value === true)

    if (!hasTimeSlot && !formData.timeSlots.other.trim()) {
      errors.timeSlots =
        "Please select at least one time slot or specify other availability"
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
        .from("volunteering_interest")
        .insert({
          name: formData.name,
          last_initial: formData.lastInitial,
          phone: formData.phone,
          email: formData.email,
          type: "general",
          program_id: 3, // Default to program ID 3
          data: {
            interests: {
              greeter: formData.interests.greeter,
              security: formData.interests.security,
              cleanup: formData.interests.cleanup,
              merch: formData.interests.merch,
              registration: formData.interests.registration,
              wherever_needed: formData.interests.wherever
            },
            time_slots: {
              thursday_pm: formData.timeSlots.thursdayPM,
              friday_am: formData.timeSlots.fridayAM,
              friday_midday: formData.timeSlots.fridayMidday,
              friday_pm: formData.timeSlots.fridayPM,
              saturday_am: formData.timeSlots.saturdayAM,
              saturday_midday: formData.timeSlots.saturdayMidday,
              saturday_pm: formData.timeSlots.saturdayPM,
              sunday_am: formData.timeSlots.sundayAM,
              sunday_midday: formData.timeSlots.sundayMidday,
              sunday_pm: formData.timeSlots.sundayPM,
              other: formData.timeSlots.other
            },
            comments: formData.comments
          }
        })

      if (error) {
        console.error("Error submitting volunteer signup:", error)
        return
      }

      console.log("Successfully submitted volunteer signup")

      // Send notification to host
      try {
        // Determine selected interests for the notification
        const selectedInterests = Object.entries(formData.interests)
          .filter(([_, selected]) => selected)
          .map(([key]) => key.replace(/([A-Z])/g, " $1").toLowerCase())
          .join(", ")

        await sendNotification({
          eventType: "host",
          programId: 1,
          data: {
            type: "volunteer",
            name: `${formData.name} ${formData.lastInitial}`,
            interests: selectedInterests
          }
        })
        console.log("Sent host notification for volunteer signup")
      } catch (notifyError) {
        console.error("Error sending host notification:", notifyError)
      }

      // Reset form and show success message
      setFormSubmitted(true)
    } catch (error) {
      console.error("Error submitting volunteer signup:", error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      lastInitial: "",
      phone: "",
      email: "",
      interests: {
        greeter: false,
        security: false,
        cleanup: false,
        setup: false,
        hostCommittee: false,
        wherever: false
      },
      timeSlots: {
        thursdayPM: false,
        fridayAM: false,
        fridayMidday: false,
        fridayPM: false,
        saturdayAM: false,
        saturdayMidday: false,
        saturdayPM: false,
        sundayAM: false,
        sundayMidday: false,
        sundayPM: false,
        other: ""
      },
      comments: ""
    })
    setFormSubmitted(false)
  }

  // Custom checkbox component
  const Checkbox = ({
    id,
    checked,
    onCheckedChange,
    label
  }: {
    id: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    label: string
  }) => {
    return (
      <TouchableOpacity
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginVertical: theme.spacing.sm
        }}
        onPress={() => onCheckedChange(!checked)}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: theme.borderRadius.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: checked ? theme.colors.primary : "transparent",
            justifyContent: "center",
            alignItems: "center",
            marginRight: theme.spacing.sm
          }}
        >
          {checked && (
            <Ionicons
              name="checkmark"
              size={16}
              color={getTextColorForBackground(theme.colors.primary)}
            />
          )}
        </View>
        <Text
          style={{
            ...theme.typography.body,
            color: theme.colors.text.primary
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    )
  }

  // Success screen after form submission
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
              program?.content?.services?.volunteering?.title ||
              "Volunteer Registration",
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
            Thank you for your interest!
          </Text>
          <Text
            style={{
              ...theme.typography.body,
              color: theme.colors.text.secondary,
              textAlign: "center",
              marginBottom: theme.spacing.xl
            }}
          >
            Your volunteer information has been submitted. We'll reach out with
            more details as the conference approaches.
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
              Submit Another Response
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }

  return (
    <ProtectedComponent requiredFeatures={["volunteering_enabled"]}>
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
              program?.content?.services?.volunteering?.title ||
              "Volunteer Signup",
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
          {/* Name field */}
          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Name <Text style={{ color: theme.colors.error }}>*</Text>
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
              value={formData.name}
              onChangeText={(text) => {
                handleInputChange("name", text)
                if (formErrors.name) {
                  setFormErrors((prev) => ({ ...prev, name: undefined }))
                }
              }}
              placeholder="Your name"
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

          {/* Last Initial field */}
          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Last Initial <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                borderWidth: 1,
                borderColor: formErrors.lastInitial
                  ? theme.colors.error
                  : theme.colors.border,
                color: theme.colors.text.primary
              }}
              value={formData.lastInitial}
              onChangeText={(text) => {
                handleInputChange("lastInitial", text)
                if (formErrors.lastInitial) {
                  setFormErrors((prev) => ({ ...prev, lastInitial: undefined }))
                }
              }}
              placeholder="Your last initial"
              placeholderTextColor={theme.colors.text.secondary}
              maxLength={3}
            />
            {formErrors.lastInitial && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginTop: 4
                }}
              >
                {formErrors.lastInitial}
              </Text>
            )}
          </View>

          {/* Phone field */}
          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Phone <Text style={{ color: theme.colors.error }}>*</Text>
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
              value={formData.phone}
              onChangeText={(text) => {
                handleInputChange("phone", text)
                if (formErrors.phone) {
                  setFormErrors((prev) => ({ ...prev, phone: undefined }))
                }
              }}
              placeholder="Your contact number"
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

          {/* Email field */}
          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Email <Text style={{ color: theme.colors.error }}>*</Text>
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
              value={formData.email}
              onChangeText={(text) => {
                handleInputChange("email", text)
                if (formErrors.email) {
                  setFormErrors((prev) => ({ ...prev, email: undefined }))
                }
              }}
              placeholder="Your email address"
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

          {/* Interests section */}
          <View style={{ gap: theme.spacing.md }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500",
                marginBottom: theme.spacing.md
              }}
            >
              Volunteer Interests{" "}
              <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>

            {formErrors.interests && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginBottom: theme.spacing.sm
                }}
              >
                {formErrors.interests}
              </Text>
            )}
            <View style={{ gap: theme.spacing.sm }}>
              <Checkbox
                id="greeter"
                checked={formData.interests.greeter}
                onCheckedChange={(checked) =>
                  handleInterestChange("greeter", checked)
                }
                label="Greeter"
              />
              <Checkbox
                id="security"
                checked={formData.interests.security}
                onCheckedChange={(checked) =>
                  handleInterestChange("security", checked)
                }
                label="Security"
              />
              <Checkbox
                id="cleanup"
                checked={formData.interests.cleanup}
                onCheckedChange={(checked) =>
                  handleInterestChange("cleanup", checked)
                }
                label="Cleanup"
              />
              <Checkbox
                id="merch"
                checked={formData.interests.merch}
                onCheckedChange={(checked) =>
                  handleInterestChange("merch", checked)
                }
                label="Merchandise"
              />
              <Checkbox
                id="registration"
                checked={formData.interests.registration}
                onCheckedChange={(checked) =>
                  handleInterestChange("registration", checked)
                }
                label="Registration"
              />
              <Checkbox
                id="wherever"
                checked={formData.interests.wherever}
                onCheckedChange={(checked) =>
                  handleInterestChange("wherever", checked)
                }
                label="Wherever I'm Needed!"
              />
            </View>
          </View>

          {/* Time Slots section */}
          <View style={{ gap: theme.spacing.md }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500",
                marginBottom: theme.spacing.md
              }}
            >
              Availability <Text style={{ color: theme.colors.error }}>*</Text>
            </Text>

            {formErrors.timeSlots && (
              <Text
                style={{
                  color: theme.colors.error,
                  fontSize: 12,
                  marginBottom: theme.spacing.sm
                }}
              >
                {formErrors.timeSlots}
              </Text>
            )}
            <View style={{ gap: theme.spacing.sm }}>
              <Checkbox
                id="thursdayPM"
                checked={formData.timeSlots.thursdayPM}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("thursdayPM", checked)
                }
                label="Thursday 08/28 PM"
              />
              <Checkbox
                id="fridayAM"
                checked={formData.timeSlots.fridayAM}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("fridayAM", checked)
                }
                label="Friday 08/29 AM"
              />
              <Checkbox
                id="fridayMidday"
                checked={formData.timeSlots.fridayMidday}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("fridayMidday", checked)
                }
                label="Friday 08/29 Midday"
              />
              <Checkbox
                id="fridayPM"
                checked={formData.timeSlots.fridayPM}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("fridayPM", checked)
                }
                label="Friday 08/29 PM"
              />
              <Checkbox
                id="saturdayAM"
                checked={formData.timeSlots.saturdayAM}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("saturdayAM", checked)
                }
                label="Saturday 08/30 AM"
              />
              <Checkbox
                id="saturdayMidday"
                checked={formData.timeSlots.saturdayMidday}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("saturdayMidday", checked)
                }
                label="Saturday 08/30 Midday"
              />
              <Checkbox
                id="saturdayPM"
                checked={formData.timeSlots.saturdayPM}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("saturdayPM", checked)
                }
                label="Saturday 08/30 PM"
              />
              <Checkbox
                id="sundayAM"
                checked={formData.timeSlots.sundayAM}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("sundayAM", checked)
                }
                label="Sunday 08/31 AM"
              />
              <Checkbox
                id="sundayMidday"
                checked={formData.timeSlots.sundayMidday}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("sundayMidday", checked)
                }
                label="Sunday 08/31 Midday"
              />
              <Checkbox
                id="sundayPM"
                checked={formData.timeSlots.sundayPM}
                onCheckedChange={(checked) =>
                  handleTimeSlotChange("sundayPM", checked)
                }
                label="Sunday 08/31 PM"
              />
            </View>
          </View>

          {/* Other Time Slot field */}
          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Other Time Slot
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
              value={formData.timeSlots.other}
              onChangeText={(text) => handleTimeSlotChange("other", text)}
              placeholder="Enter any other time slot"
              placeholderTextColor={theme.colors.text.secondary}
            />
          </View>

          {/* Comments field */}
          <View style={{ gap: theme.spacing.xs }}>
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                fontWeight: "500"
              }}
            >
              Additional Comments
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
              value={formData.comments}
              onChangeText={(text) => handleInputChange("comments", text)}
              placeholder="Any additional comments or questions"
              placeholderTextColor={theme.colors.text.secondary}
              multiline
            />
          </View>

          {/* Submit button */}
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
              Submit Volunteer Interest
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </ProtectedComponent>
  )
}

// Use the same styles as accessibility.tsx
