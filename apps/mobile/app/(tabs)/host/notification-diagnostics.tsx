import React, { useState } from 'react'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import * as Application from 'expo-application'
import { Redirect, router } from 'expo-router'
import { ActivityIndicator, ScrollView, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../../../context/ThemeContext'
import { pushProjectId, refreshPushRegistration } from '../../../lib/pushNotifications'

import { useRole } from '../../../context/RoleContext'

export default function NotificationDiagnostics() {
  const { loading, isAuthenticated, isSuperAdmin } = useRole()
  const { theme } = useTheme()
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState('Refresh to check permission and obtain this device’s current token.')
  async function refresh() {
    setBusy(true)
    try {
      if (!Device.isDevice) { setStatus('Push delivery requires a physical device. Use an installed development or store build to test delivery.'); return }
      const result = await refreshPushRegistration(true)
      setToken(result.token)
      const permission = await Notifications.getPermissionsAsync()
      setStatus(`Permission: ${permission.status}. ${result.token ? result.synced ? 'Token saved to your profile.' : 'Token ready for a single-device test. Create a profile to receive committee announcements.' : 'Enable notifications in device Settings, then refresh.'}`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to refresh push registration.') }
    finally { setBusy(false) }
  }
  if (loading) return null
  if (!isAuthenticated || !isSuperAdmin()) return <Redirect href="/host" />
  const textStyle = { color: theme.colors.text.primary, lineHeight: 24 }
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}><ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
    <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={{ paddingVertical: 12 }}><Text style={{ color: theme.colors.primary }}>← Back</Text></TouchableOpacity>
    <Text accessibilityRole="header" style={{ ...textStyle, fontWeight: '700', fontSize: 26, lineHeight: 32 }}>Notification diagnostics</Text>
    <Text style={textStyle}>Use this screen with the administrator’s single-device test. Refresh after reinstalling the app or changing notification permissions.</Text>
    <Text style={textStyle}>App {Application.nativeApplicationVersion} ({Application.nativeBuildVersion})</Text>
    <Text selectable style={textStyle}>Expo project: {pushProjectId() || 'Missing'}</Text>
    <Text accessibilityLiveRegion="polite" style={textStyle}>{status}</Text>
    {token && <><Text style={{ ...textStyle, fontWeight: '700' }}>This device’s Expo push token</Text><Text selectable style={{ ...textStyle, padding: 16, backgroundColor: theme.colors.surface }}>{token}</Text><Text style={textStyle}>Press and hold to copy. Share only with your administrator for a test.</Text></>}
    <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={refresh} style={{ minHeight: 48, padding: 14, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: 'center' }}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Refresh token</Text>}</TouchableOpacity>
  </ScrollView></SafeAreaView>
}
