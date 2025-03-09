import { StyleSheet } from "react-native"
import { theme } from "../constants/theme"

export const formStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg
  },
  description: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xl
  },
  form: {
    gap: theme.spacing.lg
  },
  inputGroup: {
    gap: theme.spacing.xs
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
    fontWeight: "500"
  },
  input: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top"
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: "center",
    marginTop: theme.spacing.lg
  },
  submitButtonText: {
    ...theme.typography.body,
    color: theme.colors.background,
    fontWeight: "500"
  }
})
