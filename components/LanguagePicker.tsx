import { Ionicons } from "@expo/vector-icons"
import React, { useState } from "react"
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import { useI18n } from "../context/I18nContext"
import { useTheme } from "../context/ThemeContext"

interface LanguagePickerProps {
  visible: boolean
  onClose: () => void
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  visible,
  onClose
}) => {
  const { theme } = useTheme()
  const { currentLanguage, availableLanguages, changeLanguage, t } = useI18n()
  const [isChanging, setIsChanging] = useState<string | null>(null)

  const styles = createStyles(theme)

  const handleLanguageChange = async (languageCode: string) => {
    if (languageCode === currentLanguage) {
      onClose()
      return
    }

    setIsChanging(languageCode)
    try {
      await changeLanguage(languageCode)
    } catch (error) {
      console.error("Error changing language:", error)
    } finally {
      setIsChanging(null)
      onClose()
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Language</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons
              name="close"
              size={24}
              color={theme.colors.text.primary}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.languageList}>
          {availableLanguages.map((language) => {
            const isSelected = language.code === currentLanguage
            const isLoading = isChanging === language.code

            return (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageItem,
                  isSelected && styles.selectedLanguageItem
                ]}
                onPress={() => handleLanguageChange(language.code)}
                disabled={isLoading}
              >
                <View style={styles.languageInfo}>
                  <Text
                    style={[
                      styles.languageName,
                      isSelected && styles.selectedLanguageName
                    ]}
                  >
                    {language.name}
                  </Text>
                  <Text
                    style={[
                      styles.languageNativeName,
                      isSelected && styles.selectedLanguageNativeName
                    ]}
                  >
                    {language.nativeName}
                  </Text>
                </View>

                <View style={styles.languageStatus}>
                  {isLoading ? (
                    <Text style={styles.loadingText}>...</Text>
                  ) : isSelected ? (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={theme.colors.primary}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Language preference will be saved for future app sessions.
          </Text>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.lg,
      paddingTop: theme.spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border
    },
    title: {
      ...theme.typography.h1,
      color: theme.colors.text.primary,
      fontWeight: "bold"
    },
    closeButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm
    },
    languageList: {
      flex: 1,
      padding: theme.spacing.lg
    },
    languageItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small
    },
    selectedLanguageItem: {
      backgroundColor: theme.colors.primaryMuted,
      borderWidth: 2,
      borderColor: theme.colors.primary
    },
    languageInfo: {
      flex: 1
    },
    languageName: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
      fontWeight: "600"
    },
    selectedLanguageName: {
      color: theme.colors.primary
    },
    languageNativeName: {
      ...theme.typography.body,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing.xs
    },
    selectedLanguageNativeName: {
      color: theme.colors.primary
    },
    languageStatus: {
      minWidth: 24,
      alignItems: "center"
    },
    loadingText: {
      ...theme.typography.body,
      color: theme.colors.text.secondary
    },
    footer: {
      padding: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border
    },
    footerText: {
      ...theme.typography.caption,
      color: theme.colors.text.secondary,
      textAlign: "center",
      fontStyle: "italic"
    }
  })
