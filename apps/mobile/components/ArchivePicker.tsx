import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { useCurrentConference } from '../context/CurrentConferenceContext'
import { useTheme } from '../context/ThemeContext'
import { ArchivedProgram, loadArchiveCatalog } from '../lib/programArchive'

export function ArchivePicker({ compact = false }: { compact?: boolean }) {
  const { theme } = useTheme()
  const { currentProgramId, selectArchive } = useCurrentConference()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [programs, setPrograms] = useState<ArchivedProgram[]>([])
  const [error, setError] = useState('')
  const showPicker = async () => {
    setOpen(true)
    setLoading(true)
    setError('')
    try { setPrograms(await loadArchiveCatalog(currentProgramId)) }
    catch { setError('Past programs could not be loaded. Please try again.') }
    finally { setLoading(false) }
  }
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={compact ? 'Switch past program' : 'Choose a past ICYPAA program'}
      onPress={showPicker} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1,
        borderColor: theme.colors.border, borderRadius: 8, backgroundColor: theme.colors.surface }}>
      <Text style={{ color: theme.colors.text.primary, fontWeight: '600' }}>{compact ? 'Switch' : 'Choose a past ICYPAA program'}</Text>
      <Ionicons name="chevron-down" size={16} color={theme.colors.text.primary} />
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0008' }}>
        <View style={{ width: '100%', maxWidth: 480, maxHeight: '80%', padding: 24, borderRadius: 16, backgroundColor: theme.colors.background }}>
          <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700', color: theme.colors.text.primary }}>Past ICYPAA programs</Text>
          <Text style={{ color: theme.colors.text.secondary, marginVertical: 12 }}>Choose a conference to look back. Programs load only when you select them.</Text>
          {loading ? <ActivityIndicator accessibilityLabel="Loading past program choices" /> : <ScrollView>
            {error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>{error}</Text> : programs.length === 0 ?
              <Text style={{ color: theme.colors.text.secondary }}>No past ICYPAA programs are available yet.</Text> : programs.map(program =>
                <TouchableOpacity key={program.id} accessibilityRole="button" onPress={() => {
                  selectArchive(program); setOpen(false); router.replace('/archive')
                }} style={{ paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  <Text style={{ color: theme.colors.text.primary, fontWeight: '600', fontSize: 17 }}>{program.title}</Text>
                  <Text style={{ color: theme.colors.text.secondary }}>{program.start_date.slice(0, 10)} – {program.end_date.slice(0, 10)}</Text>
                </TouchableOpacity>)}
          </ScrollView>}
          {error ? <TouchableOpacity accessibilityRole="button" onPress={showPicker} style={{ paddingVertical: 12 }}><Text style={{ color: theme.colors.primary }}>Try again</Text></TouchableOpacity> : null}
          <TouchableOpacity accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 44, justifyContent: 'center', marginTop: 12 }}>
            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </>
}
