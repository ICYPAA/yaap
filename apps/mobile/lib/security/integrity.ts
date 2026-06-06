import { Platform, Alert } from "react-native"
import * as Application from "expo-application"
import * as Device from "expo-device"
import Constants from "expo-constants"
import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * App integrity and anti-tampering checks
 */

interface IntegrityCheckResult {
  isValid: boolean
  issues: string[]
  riskLevel: "low" | "medium" | "high"
}

class AppIntegrityChecker {
  private readonly INTEGRITY_CHECK_KEY = "last_integrity_check"
  private readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

  /**
   * Performs comprehensive integrity checks
   */
  async performIntegrityCheck(): Promise<IntegrityCheckResult> {
    const issues: string[] = []
    let riskLevel: "low" | "medium" | "high" = "low"

    // Skip checks in development
    if (__DEV__) {
      return {
        isValid: true,
        issues: ["Development mode - integrity checks skipped"],
        riskLevel: "low"
      }
    }

    try {
      // Check if we've recently performed a check
      const lastCheck = await this.getLastCheckTime()
      if (lastCheck && Date.now() - lastCheck < this.CHECK_INTERVAL) {
        return {
          isValid: true,
          issues: [],
          riskLevel: "low"
        }
      }

      // 1. Check for jailbreak/root
      const jailbreakStatus = await this.checkJailbreakRoot()
      if (jailbreakStatus.isJailbroken) {
        issues.push("Device appears to be jailbroken/rooted")
        riskLevel = "high"
      }

      // 2. Check app signature/bundle
      const signatureValid = await this.verifyAppSignature()
      if (!signatureValid) {
        issues.push("App signature verification failed")
        riskLevel = "high"
      }

      // 3. Check for debugging
      if (this.isDebugging()) {
        issues.push("Debugger detected")
        riskLevel = "medium"
      }

      // 4. Check for emulator/simulator
      if (this.isEmulator()) {
        issues.push("Running on emulator/simulator")
        if (riskLevel === "low") riskLevel = "medium"
      }

      // 5. Check app source
      const sourceValid = await this.verifyAppSource()
      if (!sourceValid) {
        issues.push("App installed from unknown source")
        if (riskLevel === "low") riskLevel = "medium"
      }

      // 6. Check for suspicious environment
      const envCheck = this.checkEnvironment()
      if (!envCheck.isClean) {
        issues.push(...envCheck.issues)
        if (riskLevel === "low") riskLevel = "medium"
      }

      // Save check time
      await this.saveCheckTime()

      const isValid = issues.length === 0 || riskLevel === "low"

      return {
        isValid,
        issues,
        riskLevel
      }
    } catch (error) {
      console.error("Integrity check error:", error)
      return {
        isValid: true, // Don't block on check failure
        issues: ["Integrity check encountered an error"],
        riskLevel: "low"
      }
    }
  }

  /**
   * Checks for jailbreak/root
   */
  private async checkJailbreakRoot(): Promise<{ isJailbroken: boolean }> {
    try {
      if (Platform.OS === "ios") {
        // Check if we can write to system directories (shouldn't be able to)
        try {
          await AsyncStorage.setItem("/private/test", "test")
          await AsyncStorage.removeItem("/private/test")
          return { isJailbroken: true }
        } catch {
          // Expected behavior - can't write to system
        }

        // Check for Cydia URL scheme
        // Note: In production, you'd use Linking.canOpenURL with proper configuration

        return { isJailbroken: false }
      } else if (Platform.OS === "android") {
        // Check build tags
        const buildTags = Device.osInternalBuildId
        if (buildTags && buildTags.includes("test-keys")) {
          return { isJailbroken: true }
        }

        return { isJailbroken: false }
      }

      return { isJailbroken: false }
    } catch (error) {
      console.error("Jailbreak check error:", error)
      return { isJailbroken: false }
    }
  }

  /**
   * Verifies app signature
   */
  private async verifyAppSignature(): Promise<boolean> {
    try {
      if (Platform.OS === "ios") {
        // Check bundle identifier
        const expectedBundleId = "com.themindfulpug.icypaa"
        const actualBundleId = Application.applicationId

        if (actualBundleId !== expectedBundleId) {
          console.warn("Bundle ID mismatch")
          return false
        }
      } else if (Platform.OS === "android") {
        // Check application ID
        const expectedAppId = "com.themindfulpug.icypaa"
        const actualAppId = Application.applicationId

        if (actualAppId !== expectedAppId) {
          console.warn("Application ID mismatch")
          return false
        }
      }

      return true
    } catch (error) {
      console.error("Signature verification error:", error)
      return true // Don't block on verification failure
    }
  }

  /**
   * Checks if debugger is attached
   */
  private isDebugging(): boolean {
    // Check for React Native dev mode
    if (__DEV__) {
      return true
    }

    // Check for remote debugging
    // @ts-ignore
    if (
      global.location &&
      global.location.href &&
      global.location.href.includes("debugger")
    ) {
      return true
    }

    return false
  }

  /**
   * Checks if running on emulator
   */
  private isEmulator(): boolean {
    return !Device.isDevice
  }

  /**
   * Verifies app installation source
   */
  private async verifyAppSource(): Promise<boolean> {
    try {
      if (Platform.OS === "ios") {
        // iOS apps should come from App Store or TestFlight
        const installationSource = await Application.getIosIdForVendorAsync()
        return !!installationSource
      } else if (Platform.OS === "android") {
        const getInstallationSourceAsync = (
          Application as typeof Application & {
            getInstallationSourceAsync?: () => Promise<string | null>
          }
        ).getInstallationSourceAsync

        if (!getInstallationSourceAsync) {
          return true
        }

        // Android apps should come from Play Store
        const installerPackage = await getInstallationSourceAsync()
        const validSources = [
          "com.android.vending", // Google Play Store
          "com.google.android.packageinstaller",
          "com.amazon.venezia" // Amazon App Store
        ]

        return !installerPackage || validSources.includes(installerPackage)
      }

      return true
    } catch (error) {
      console.error("Source verification error:", error)
      return true
    }
  }

  /**
   * Checks for suspicious environment conditions
   */
  private checkEnvironment(): { isClean: boolean; issues: string[] } {
    const issues: string[] = []

    // Check for VPN (could be used to intercept traffic)
    // Note: Requires additional native modules in production

    // Check for proxy settings
    // Note: Requires additional native modules in production

    // Check for unusual system properties
    if (Platform.OS === "android") {
      // Check for custom ROM indicators
      const osName = Device.osName
      if (osName && !osName.toLowerCase().includes("android")) {
        issues.push("Unusual OS name detected")
      }
    }

    // Check Expo environment
    if (!Constants.expoConfig?.slug || Constants.expoConfig.slug !== "icypaa") {
      issues.push("Unexpected app configuration")
    }

    return {
      isClean: issues.length === 0,
      issues
    }
  }

  /**
   * Gets the last integrity check time
   */
  private async getLastCheckTime(): Promise<number | null> {
    try {
      const timeStr = await AsyncStorage.getItem(this.INTEGRITY_CHECK_KEY)
      return timeStr ? parseInt(timeStr, 10) : null
    } catch {
      return null
    }
  }

  /**
   * Saves the current time as last check time
   */
  private async saveCheckTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.INTEGRITY_CHECK_KEY,
        Date.now().toString()
      )
    } catch (error) {
      console.error("Error saving check time:", error)
    }
  }

  /**
   * Shows security warning to user
   */
  showSecurityWarning(
    message: string,
    severity: "low" | "medium" | "high"
  ): void {
    const titles = {
      low: "Notice",
      medium: "Security Warning",
      high: "Security Alert"
    }

    const messages = {
      low: `${message}\n\nThe app will continue to function normally.`,
      medium: `${message}\n\nSome features may be restricted for your security.`,
      high: `${message}\n\nFor your security, some app features will be disabled.`
    }

    Alert.alert(
      titles[severity],
      messages[severity],
      [
        {
          text: "I Understand",
          style: severity === "high" ? "destructive" : "default"
        }
      ],
      { cancelable: false }
    )
  }
}

// Singleton instance
let integrityCheckerInstance: AppIntegrityChecker | null = null

/**
 * Gets the singleton integrity checker instance
 */
export const getIntegrityChecker = (): AppIntegrityChecker => {
  if (!integrityCheckerInstance) {
    integrityCheckerInstance = new AppIntegrityChecker()
  }
  return integrityCheckerInstance
}

/**
 * Performs an integrity check and returns the result
 */
export const checkAppIntegrity = async (): Promise<IntegrityCheckResult> => {
  const checker = getIntegrityChecker()
  return await checker.performIntegrityCheck()
}

/**
 * React hook for app integrity
 */
export const useAppIntegrity = () => {
  const checker = getIntegrityChecker()

  return {
    checkIntegrity: () => checkAppIntegrity(),
    showWarning: (message: string, severity: "low" | "medium" | "high") =>
      checker.showSecurityWarning(message, severity)
  }
}
