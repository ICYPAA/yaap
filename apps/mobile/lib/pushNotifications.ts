import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { getOrCreateDeviceId } from './security/deviceId'
import { withDeviceId } from './supabase'

export const pushProjectId = () => Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId

export async function getPushToken(requestPermission = false): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', {
    name: 'Conference notifications', importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250]
  })
  let permission = await Notifications.getPermissionsAsync()
  if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync()
  if (!permission.granted) return null
  const projectId = pushProjectId()
  if (!projectId) throw new Error('The app is missing its Expo project ID. Rebuild with the production configuration.')
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data
}

export async function registerForPushNotificationsAsync() {
  try { return await getPushToken(true) }
  catch { return null }
}

export async function refreshPushRegistration(requestPermission = false) {
  const token = await getPushToken(requestPermission)
  if (!token) return { token: null, synced: false }
  const deviceId = await getOrCreateDeviceId()
  const client = await withDeviceId()
  const { data, error } = await client.from('users').update({ expo_push_token: token }).eq('device_id', deviceId).select('id')
  if (error) throw new Error('The token was obtained but could not be saved to your profile. Try again when connected.')
  return { token, synced: Boolean(data?.length) }
}
