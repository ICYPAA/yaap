import React from 'react'
import { Redirect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArchivePicker } from '../components/ArchivePicker'
import { useCurrentConference } from '../context/CurrentConferenceContext'
import { useTheme } from '../context/ThemeContext'
import { resolveConferenceTimeZone } from '../lib/conferenceTime'
import Program from './(tabs)/program'

export default function ArchiveScreen() {
  const { archiveProgram, archiveDetails, selectArchive } = useCurrentConference()
  const { theme } = useTheme()
  if (!archiveProgram) return <Redirect href="/" />
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontSize: 12, color: theme.colors.text.secondary }}>
        {archiveDetails ? resolveConferenceTimeZone(archiveDetails).replace(/_/g, ' ') : ''}
      </Text>
      <ArchivePicker compact />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Exit look back" onPress={() => { selectArchive(null); router.replace('/') }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="close" size={22} color={theme.colors.text.primary} />
      </TouchableOpacity>
    </View>
    <Program key={archiveProgram.id} />
  </SafeAreaView>
}
