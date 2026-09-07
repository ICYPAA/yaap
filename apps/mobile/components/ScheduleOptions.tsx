import React, { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Modal, Pressable, Switch, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'

type Group = 'category' | 'time' | 'room'
type Props = {
  isArchive: boolean
  showGrouping: boolean
  groupBy: Group
  onGroupChange: (group: Group) => void
  hidePast: boolean
  onHidePastChange: (hidden: boolean) => void
  timeZone: string
}

export function ScheduleOptions({ isArchive, showGrouping, groupBy, onGroupChange, hidePast, onHidePastChange, timeZone }: Props) {
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  if (isArchive && !showGrouping) return null
  const modified = (!isArchive && hidePast) || (showGrouping && groupBy !== 'category')
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Schedule options" accessibilityHint={modified ? 'Custom schedule options are applied' : 'Group events or hide past events'}
      onPress={() => setOpen(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
      <Ionicons name="options-outline" size={22} color={modified ? theme.colors.primary : theme.colors.text.secondary} />
      {modified && <View style={{ position: 'absolute', right: 6, top: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.primary }} />}
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#0005' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss schedule options" onPress={() => setOpen(false)} style={{ flex: 1 }} />
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text.primary }}>Schedule options</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close schedule options" onPress={() => setOpen(false)} style={{ padding: 12 }}><Ionicons name="close" size={22} color={theme.colors.text.primary} /></TouchableOpacity>
          </View>
          {showGrouping && <View style={{ marginTop: 12 }}>
            <Text style={{ color: theme.colors.text.secondary, fontSize: 13, marginBottom: 6 }}>Group list by</Text>
            {(['category', 'time', 'room'] as const).map(group => <TouchableOpacity key={group} accessibilityRole="radio" accessibilityState={{ checked: groupBy === group }} onPress={() => onGroupChange(group)}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.text.primary, fontSize: 16 }}>{group === 'category' ? 'Event type' : group === 'time' ? 'Time' : 'Room'}</Text>
              {groupBy === group && <Ionicons name="checkmark" size={22} color={theme.colors.primary} />}
            </TouchableOpacity>)}
          </View>}
          {!isArchive && <View style={{ paddingVertical: 16, borderTopWidth: showGrouping ? 1 : 0, borderColor: theme.colors.border, marginTop: 12, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.text.primary, fontSize: 16 }}>Hide past events</Text>
              <Switch accessibilityLabel="Hide past events" value={hidePast} onValueChange={onHidePastChange} trackColor={{ true: theme.colors.primary }} />
            </View>
            <Text style={{ color: theme.colors.text.secondary, fontSize: 12 }}>All times: {timeZone.replace(/_/g, ' ')}</Text>
          </View>}
        </SafeAreaView>
      </View>
    </Modal>
  </>
}
