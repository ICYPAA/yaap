import { router } from "expo-router"
import React, { useEffect } from "react"
import { Image, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTheme } from "../context/ThemeContext"

const HAS_LAUNCHED_KEY = "hasLaunchedApp"

export default function LandingScreen() {
  const { theme } = useTheme()
  const styles = createStyles(theme)
  // const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // checkIfFirstLaunch()

    // Delay navigation slightly to ensure layout is mounted
    const timer = setTimeout(() => {
      router.replace("/(tabs)/program")
    }, 0)

    // Clear the timeout if the component unmounts before navigation
    return () => clearTimeout(timer)
  }, [])

  // const checkIfFirstLaunch = async () => {
  //   try {
  //     const hasLaunched = await AsyncStorage.getItem(HAS_LAUNCHED_KEY)

  //     if (hasLaunched === "true") {
  //       // User has launched the app before, redirect to program page
  //       router.replace("/(tabs)/program")
  //     } else {
  //       // First time user, show the landing screen
  //       setIsLoading(false)
  //     }
  //   } catch (error) {
  //     console.error("Error checking first launch status:", error)
  //     // If there's an error, show the landing screen as a fallback
  //     setIsLoading(false)
  //   }
  // }

  // const handleEnterApp = async () => {
  //   try {
  //     // Save that user has launched the app
  //     await AsyncStorage.setItem(HAS_LAUNCHED_KEY, "true")
  //     router.replace("/(tabs)/program")
  //   } catch (error) {
  //     console.error("Error saving launch status:", error)
  //     // If saving fails, still navigate to the program page
  //     router.replace("/(tabs)/program")
  //   }
  // }

  // if (isLoading) {
  //   return (
  //     <SafeAreaView style={styles.container}>
  //       <View style={styles.content}>
  //         <Image
  //           source={require("../assets/images/adaptive-icon.png")}
  //           style={styles.logo}
  //           resizeMode="contain"
  //         />
  //       </View>
  //     </SafeAreaView>
  //   )
  // }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require("../assets/images/adaptive-icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Welcome to ICYPAA</Text>
        <Text style={styles.subtitle}>
          International Conference of Young People in Alcoholics Anonymous
        </Text>

        <View style={styles.buttonContainer}>
          {/* <TouchableOpacity style={styles.button} onPress={handleEnterApp}>
            <Text style={styles.buttonText}>Enter Conference App</Text>
          </TouchableOpacity> */}
        </View>
      </View>
    </SafeAreaView>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg
    },
    logo: {
      width: 200,
      height: 200,
      marginBottom: theme.spacing.xl
    },
    title: {
      ...theme.typography.h1,
      color: theme.colors.text.primary,
      fontWeight: "bold",
      marginBottom: theme.spacing.sm,
      textAlign: "center"
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      textAlign: "center",
      marginBottom: theme.spacing.xl
    },
    buttonContainer: {
      width: "100%",
      marginTop: theme.spacing.lg
    },
    button: {
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      alignItems: "center"
    },
    buttonText: {
      color: "#FFFFFF",
      ...theme.typography.body,
      fontWeight: "bold"
    }
  })
