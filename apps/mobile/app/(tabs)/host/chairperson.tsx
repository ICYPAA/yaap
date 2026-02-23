import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React from "react"
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import ChairpersonSchedule from "../../../components/ChairpersonSchedule"
import { useTheme } from "../../../context/ThemeContext"
import { supabase } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

export default function ChairpersonPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [user, setUser] = React.useState<any>(null)
  const [userIdentifier, setUserIdentifier] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser()
    console.log("Chairperson: Auth user data:", {
      id: user?.id,
      email: user?.email,
      phone: user?.phone,
      metadata: user?.user_metadata
    })
    setUser(user)
    
    // Try to use email first, then phone, then ID
    // This gives us the best chance of matching shift assignments
    const identifier = user?.email || user?.phone || user?.id
    setUserIdentifier(identifier)
    console.log("Using identifier for shift matching:", identifier)
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <SafeAreaView style={styles(theme).container}>
      <View style={styles(theme).header}>
        <TouchableOpacity onPress={handleBack} style={styles(theme).backButton}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={getTextColorForBackground(theme.colors.primary)}
          />
        </TouchableOpacity>
        <Text style={styles(theme).title}>Chairperson Schedule</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles(theme).scrollContainer}>
        <ChairpersonSchedule userId={userIdentifier} />
        
        <View style={styles(theme).infoCard}>
          <Text style={styles(theme).infoTitle}>About Your Schedule</Text>
          <Text style={styles(theme).infoText}>
            This schedule shows all events where you have been assigned as a chairperson. 
            Your responsibilities and notes for each event are included.
          </Text>
          <Text style={styles(theme).infoText}>
            Please arrive at least 15 minutes early for any event you are chairing to 
            ensure proper setup and coordination with volunteers.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.md,
      backgroundColor: theme.colors.primary
    },
    backButton: {
      padding: theme.spacing.sm
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: getTextColorForBackground(theme.colors.primary)
    },
    scrollContainer: {
      flex: 1,
      padding: theme.spacing.md
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xl,
      ...theme.shadows.small
    },
    infoTitle: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      fontWeight: "bold",
      marginBottom: theme.spacing.md
    },
    infoText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      lineHeight: 20,
      marginBottom: theme.spacing.sm
    }
  })