import { Ionicons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Stack, useRouter } from "expo-router"
import React, { useEffect, useRef, useState } from "react"
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { ProtectedComponent } from "../../../components/ProtectedComponent"
import { useTheme } from "../../../context/ThemeContext"
import { sendNotification } from "../../../lib/notificationHelper"
import { supabase, withDeviceId } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

interface Message {
  sender: string
  message: string
  timestamp: string
}

interface SupportChat {
  id: number
  chat_title: string
  messages: Message[]
  device_id: string
  name: string
  created_at: string
  status?: string
}

export default function SupportRequest() {
  const { theme } = useTheme()
  const router = useRouter()
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [supportChats, setSupportChats] = useState<SupportChat[]>([])
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null)
  const [message, setMessage] = useState("")
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [newChatModalVisible, setNewChatModalVisible] = useState(false)
  const [newChatTitle, setNewChatTitle] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const drawerAnimation = useRef(new Animated.Value(-300)).current
  const flatListRef = useRef<FlatList>(null)

  // Get device ID on mount
  useEffect(() => {
    const getDeviceId = async () => {
      try {
        let storedDeviceId = await AsyncStorage.getItem("device_id")
        if (!storedDeviceId) {
          // Generate a new device ID if none exists
          storedDeviceId = `device_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 9)}`
          await AsyncStorage.setItem("device_id", storedDeviceId)
        }

        setDeviceId(storedDeviceId)

        // Try to get user name from AsyncStorage
        const storedUserName = await AsyncStorage.getItem("user_name")
        if (storedUserName) {
          setUserName(storedUserName)
        }

        // Fetch support chats for this device
        await fetchSupportChats(storedDeviceId)
      } catch (error) {
        console.error("Error loading device ID:", error)
      } finally {
        setLoading(false)
      }
    }

    getDeviceId()
  }, [])

  const fetchSupportChats = async (device_id: string) => {
    try {
      const supabaseWithDeviceId = await withDeviceId()
      const { data, error } = await supabaseWithDeviceId
        .from("support_chats")
        .select("*")
        .eq("device_id", device_id)
        .order("created_at", { ascending: false })

      if (error) throw error

      setSupportChats(data || [])

      // Auto-select the first chat if available and none selected
      if (data && data.length > 0 && !selectedChat) {
        setSelectedChat(data[0])
      }
    } catch (error) {
      console.error("Error fetching support chats:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedChat || !message.trim() || !deviceId) return

    try {
      const supabaseWithDeviceId = await withDeviceId()
      const newMessage = {
        sender: deviceId,
        message: message.trim(),
        timestamp: new Date().toISOString()
      }

      const updatedMessages = [...selectedChat.messages, newMessage]

      // Check if chat was previously resolved and update status to unread
      const newStatus =
        selectedChat.status === "resolved" ? "unread" : selectedChat.status

      const { error } = await supabaseWithDeviceId
        .from("support_chats")
        .update({
          messages: updatedMessages,
          status: newStatus
        })
        .eq("id", selectedChat.id)

      if (error) throw error

      // Update local state
      setSelectedChat({
        ...selectedChat,
        messages: updatedMessages,
        status: newStatus
      })

      // Update the chat in the list
      setSupportChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === selectedChat.id
            ? { ...chat, messages: updatedMessages, status: newStatus }
            : chat
        )
      )

      // Clear message input
      setMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const handleCreateNewChat = async () => {
    if (newChatTitle.trim() === "") {
      setError("Please enter a title for your chat")
      return
    }

    setIsCreating(true)
    setError("")

    try {
      // Get device ID for chat association
      let deviceId = await AsyncStorage.getItem("device_id")
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`
        await AsyncStorage.setItem("device_id", deviceId)
      }

      // Save the user name to AsyncStorage
      if (userName.trim()) {
        await AsyncStorage.setItem("user_name", userName)
      }

      const {
        data: { session }
      } = await supabase.auth.getSession()
      const ownerId = session?.user?.id

      // Create the chat in Supabase
      const supabaseWithDeviceId = await withDeviceId()
      const { data, error } = await supabaseWithDeviceId
        .from("support_chats")
        .insert({
          program_id: 3, // Default to program ID 3
          chat_title: newChatTitle,
          messages: [], // Start with empty messages
          device_id: deviceId,
          name: userName || "Anonymous", // Use the username or fallback to "Anonymous"
          status: "unread", // Set initial status to unread
          ...(ownerId ? { owner_id: ownerId } : {})
        })
        .select()

      if (error) {
        throw error
      }

      // Add the new chat to state
      const newChat = data[0]
      setSupportChats((prevChats) => [newChat, ...prevChats])

      // Send notification to host
      try {
        await sendNotification({
          eventType: "host",
          programId: 3,
          data: {
            type: "support",
            form_id: newChat.id,
            name: userName || "Anonymous",
            title: newChatTitle
          }
        })
      } catch (notifyError) {
        console.error("Error sending host notification:", notifyError)
      }

      // Set as active chat and close modal
      setSelectedChat(newChat)
      setNewChatModalVisible(false)
      setNewChatTitle("")
    } catch (error) {
      console.error("Error creating chat:", error)
      setError("Failed to create chat. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const openDrawer = () => {
    setDrawerVisible(true)
    Animated.timing(drawerAnimation, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true
    }).start()
  }

  const closeDrawer = () => {
    Animated.timing(drawerAnimation, {
      toValue: -300,
      duration: 250,
      useNativeDriver: true
    }).start(() => {
      setDrawerVisible(false)
    })
  }

  const selectChat = (chat: SupportChat) => {
    setSelectedChat(chat)
    closeDrawer()
  }

  return (
    <ProtectedComponent requiredFeatures={["support_chat_enabled"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 130 : 0}
      >
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Stack.Screen
          options={{
            title: selectedChat ? selectedChat.chat_title : "Support",
            headerStyle: {
              backgroundColor: theme.colors.background
            },
            headerTitleStyle: {
              color: theme.colors.text.primary
            },
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ padding: 8 }}
              >
                <Ionicons
                  name="chevron-back"
                  size={28}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>
            ),
            headerRight: () => (
              <View style={{ flexDirection: "row" }}>
                <TouchableOpacity onPress={openDrawer} style={{ padding: 8 }}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={24}
                    color={theme.colors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            )
          }}
        />

        {loading ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Text style={{ color: theme.colors.text.primary }}>Loading...</Text>
          </View>
        ) : supportChats.length === 0 ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 16
            }}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={64}
              color={theme.colors.text.secondary}
              style={{ marginBottom: 16 }}
            />
            <Text
              style={{
                ...theme.typography.body,
                color: theme.colors.text.primary,
                textAlign: "center",
                marginBottom: 24
              }}
            >
              You don't have any support chats yet.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: theme.colors.primary,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                alignItems: "center"
              }}
              onPress={() => setNewChatModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  ...theme.typography.body,
                  color: getTextColorForBackground(theme.colors.primary),
                  fontWeight: "500"
                }}
              >
                Start a New Support Chat
              </Text>
            </TouchableOpacity>
          </View>
        ) : selectedChat ? (
          <View style={{ flex: 1 }}>
            <FlatList
              data={selectedChat.messages}
              keyExtractor={(_, index) => `msg-${index}`}
              renderItem={({ item }) => (
                <View
                  style={{
                    alignSelf:
                      item.sender === deviceId ? "flex-end" : "flex-start",
                    backgroundColor:
                      item.sender === deviceId
                        ? theme.colors.primary
                        : theme.colors.surface,
                    padding: 12,
                    margin: 8,
                    borderRadius: 16,
                    maxWidth: "75%",
                    borderBottomLeftRadius: item.sender === deviceId ? 16 : 4,
                    borderBottomRightRadius: item.sender === deviceId ? 4 : 16
                  }}
                >
                  <Text
                    style={{
                      color:
                        item.sender === deviceId
                          ? getTextColorForBackground(theme.colors.primary)
                          : theme.colors.text.primary
                    }}
                  >
                    {item.message}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color:
                        item.sender === deviceId
                          ? getTextColorForBackground(theme.colors.primary)
                          : theme.colors.text.secondary,
                      alignSelf: "flex-end",
                      marginTop: 4,
                      opacity: 0.8
                    }}
                  >
                    {new Date(item.timestamp || "").toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </Text>
                </View>
              )}
              ref={flatListRef}
              contentContainerStyle={[
                { paddingVertical: 10 },
                { flexGrow: 1, paddingBottom: 10 }
              ]}
              onLayout={() => {
                if (selectedChat.messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false })
                }
              }}
              onContentSizeChange={() => {
                if (selectedChat.messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
              }}
              keyboardShouldPersistTaps="handled"
            />
            <View
              style={{
                flexDirection: "row",
                padding: 10,
                borderTopWidth: 1,
                borderTopColor: theme.colors.border,
                backgroundColor: theme.colors.background
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.surface,
                  padding: 12,
                  borderRadius: 20,
                  marginRight: 10,
                  color: theme.colors.text.primary,
                  marginBottom: 10
                }}
                value={message}
                onChangeText={setMessage}
                placeholder="Type a message..."
                placeholderTextColor={theme.colors.text.secondary}
              />
              <TouchableOpacity
                style={{
                  backgroundColor: theme.colors.primary,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: !message.trim() ? 0.5 : 1
                }}
                onPress={handleSendMessage}
                disabled={!message.trim()}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={getTextColorForBackground(theme.colors.primary)}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 16
            }}
          >
            <TouchableOpacity
              style={{
                backgroundColor: theme.colors.primary,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.sm,
                alignItems: "center"
              }}
              onPress={() => setNewChatModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  ...theme.typography.body,
                  color: getTextColorForBackground(theme.colors.primary),
                  fontWeight: "500"
                }}
              >
                Start a New Support Chat
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chat Drawer */}
        {drawerVisible && (
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "rgba(0,0,0,0.5)"
            }}
          >
            <TouchableOpacity style={{ flex: 1 }} onPress={closeDrawer} />
          </View>
        )}

        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 300,
              backgroundColor: theme.colors.surface,
              borderRightWidth: 1,
              borderRightColor: theme.colors.border,
              transform: [{ translateX: drawerAnimation }],
              zIndex: 1000
            }
          ]}
        >
          <View
            style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: theme.colors.text.primary
                }}
              >
                Your Chats
              </Text>
              <TouchableOpacity onPress={closeDrawer}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: theme.colors.primary,
                padding: 12,
                borderRadius: 8,
                alignItems: "center",
                marginTop: 16
              }}
              onPress={() => setNewChatModalVisible(true)}
            >
              <Text
                style={{
                  color: getTextColorForBackground(theme.colors.primary),
                  fontWeight: "500"
                }}
              >
                New Support Chat
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={supportChats}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  backgroundColor:
                    selectedChat?.id === item.id
                      ? theme.colors.surface
                      : "transparent"
                }}
                onPress={() => selectChat(item)}
              >
                <Text
                  style={{
                    ...theme.typography.body,
                    color: theme.colors.text.primary,
                    fontWeight: "500",
                    marginBottom: 4
                  }}
                >
                  {item.chat_title}
                </Text>
                <Text
                  style={{
                    ...theme.typography.caption,
                    color: theme.colors.text.secondary,
                    marginBottom: 4
                  }}
                  numberOfLines={1}
                >
                  {item.messages.length > 0
                    ? item.messages[item.messages.length - 1].message
                    : "No messages yet"}
                </Text>
                <Text
                  style={{
                    ...theme.typography.caption,
                    color: theme.colors.text.secondary,
                    fontSize: 10
                  }}
                >
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ padding: 16, alignItems: "center" }}>
                <Text style={{ color: theme.colors.text.secondary }}>
                  No chats found
                </Text>
              </View>
            }
          />
        </Animated.View>

        {/* New Chat Modal */}
        <Modal
          visible={newChatModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setNewChatModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.5)",
              padding: 20
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.background,
                borderRadius: 12,
                padding: 20
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: theme.colors.text.primary,
                  marginBottom: 16
                }}
              >
                Create New Support Chat
              </Text>

              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    ...theme.typography.body,
                    color: theme.colors.text.primary,
                    marginBottom: 8,
                    fontWeight: "500"
                  }}
                >
                  Your Name
                </Text>
                <TextInput
                  style={{
                    backgroundColor: theme.colors.surface,
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="Your name"
                  placeholderTextColor={theme.colors.text.secondary}
                  value={userName}
                  onChangeText={setUserName}
                />
              </View>

              <Text
                style={{
                  ...theme.typography.body,
                  color: theme.colors.text.primary,
                  marginBottom: 8,
                  fontWeight: "500"
                }}
              >
                Chat Title
              </Text>
              <TextInput
                style={{
                  backgroundColor: theme.colors.surface,
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  color: theme.colors.text.primary,
                  marginBottom: 20
                }}
                value={newChatTitle}
                onChangeText={setNewChatTitle}
                placeholder="Enter a title for your support request"
                placeholderTextColor={theme.colors.text.secondary}
              />

              {error && (
                <Text
                  style={{
                    color: theme.colors.error,
                    marginBottom: 16
                  }}
                >
                  {error}
                </Text>
              )}

              <View
                style={{ flexDirection: "row", justifyContent: "flex-end" }}
              >
                <TouchableOpacity
                  style={{
                    padding: 12,
                    marginRight: 12
                  }}
                  onPress={() => setNewChatModalVisible(false)}
                >
                  <Text
                    style={{
                      ...theme.typography.body,
                      color: theme.colors.text.secondary
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: theme.colors.primary,
                    padding: 12,
                    borderRadius: 8
                  }}
                  onPress={handleCreateNewChat}
                  disabled={isCreating}
                >
                  <Text
                    style={{
                      ...theme.typography.body,
                      color: getTextColorForBackground(theme.colors.primary)
                    }}
                  >
                    Create
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
      </KeyboardAvoidingView>
    </ProtectedComponent>
  )
}
