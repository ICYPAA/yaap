import { Link, Stack } from "expo-router"
import React from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useTheme } from "../context/ThemeContext"

export default function NotFoundScreen() {
  const { theme } = useTheme()
  const styles = createStyles(theme)

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/(tabs)/program" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>Go to home screen!</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  )
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      backgroundColor: theme.colors.background
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.text.primary,
      marginBottom: theme.spacing.lg
    },
    link: {
      marginTop: 15,
      paddingVertical: 15,
      paddingHorizontal: 25,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.md
    },
    linkText: {
      fontSize: 14,
      color: "#fff",
      fontWeight: "bold"
    }
  })
