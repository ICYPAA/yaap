import React from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { theme } from "../../../constants/theme"

export default function HostLogin() {
  const handleDiscordLogin = () => {
    // Implement Discord OAuth login
    console.log("Logging in with Discord...")
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Host Committee Login</Text>
      <Text style={styles.description}>
        Access host committee features and settings by logging in with your
        Discord account.
      </Text>
      <TouchableOpacity style={styles.loginButton} onPress={handleDiscordLogin}>
        <Text style={styles.loginButtonText}>Login with Discord</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    justifyContent: "center",
    alignItems: "center"
  },
  title: {
    ...theme.typography.h1,
    marginBottom: theme.spacing.md,
    color: theme.colors.text.primary
  },
  description: {
    ...theme.typography.body,
    textAlign: "center",
    marginBottom: theme.spacing.xl,
    color: theme.colors.text.secondary
  },
  loginButton: {
    backgroundColor: "#5865F2", // Discord brand color
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    minWidth: 200,
    alignItems: "center"
  },
  loginButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: "500"
  }
})
