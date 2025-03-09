import * as Notifications from "expo-notifications"
import { useEffect } from "react"
import { Platform } from "react-native"

export default function useNotifications() {
  useEffect(() => {
    registerForPushNotificationsAsync()

    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(notification)
      }
    )

    return () => subscription.remove()
  }, [])
}

async function registerForPushNotificationsAsync() {
  let token
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C"
    })
  }

  token = (await Notifications.getExpoPushTokenAsync()).data
  console.log(token)

  return token
}
