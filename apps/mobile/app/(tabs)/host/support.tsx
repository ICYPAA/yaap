import { Ionicons } from "@expo/vector-icons"
import { useFocusEffect } from "@react-navigation/native"
import { useRouter } from "expo-router"
import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { useCurrentConference } from "../../../context/CurrentConferenceContext"
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { sendNotification } from "../../../lib/notificationHelper"
import { makeRequest } from "../../../lib/requestHelper"
import {
  getCurrentUserWithRole,
  hasPermission,
  Permission
} from "../../../lib/roleChecker"
import { withDeviceId } from "../../../lib/supabase"
import { getTextColorForBackground } from "../../../lib/theme"

interface ChatMessage {
  id?: string
  sender: string
  message: string
  timestamp: string
}

interface SupportChat {
  id: string
  program_id: number
  chat_title: string
  device_id: string
  name: string
  messages: ChatMessage[]
  status?: string
  created_at: string
}

export default function SupportChats() {
  const router = useRouter()
  const { isDebugMode } = useDebug()
  const { theme } = useTheme()
  const currentConference = useCurrentConference()
  const programId =
    currentConference.status === "active"
      ? currentConference.currentProgramId
      : null
  const [chats, setChats] = useState<SupportChat[]>([])
  const [filteredChats, setFilteredChats] = useState<SupportChat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null)
  const [replyText, setReplyText] = useState("")
  const [drawerVisible, setDrawerVisible] = useState(true)
  const [canEditSupport, setCanEditSupport] = useState(false)
  const subscriptionRef = useRef<{ unsubscribe?: () => void }>({})
  const flatListRef = useRef<FlatList>(null)

  const drawerAnimation = useRef(new Animated.Value(0)).current
  const styles = React.useMemo(() => createStyles(theme), [theme])

  const checkPermissions = useCallback(async () => {
    const userWithRole = await getCurrentUserWithRole()
    if (userWithRole) {
      const canRead = hasPermission(
        userWithRole.role,
        Permission.SUPPORT_READ,
        userWithRole.dbPermissions
      )
      const canEdit = hasPermission(
        userWithRole.role,
        Permission.SUPPORT_EDIT,
        userWithRole.dbPermissions
      )
      setCanEditSupport(canEdit)
      
      // If user doesn't have read permission, redirect them
      if (!canRead) {
        router.replace("/not-authorized" as any)
      }
    }
  }, [router])

  useEffect(() => {
    // Filter out resolved chats
    if (chats.length > 0) {
      const filteredResult = chats.filter(
        (chat: SupportChat) => chat.status !== "resolved"
      )
      setFilteredChats(filteredResult)
    }
  }, [chats])

  const handleNewChat = useCallback((newRecord: any) => {
    if (!newRecord) return

    // Add to chats list
    setChats((prev) => [newRecord, ...prev])

    // If this is an unread chat and no chat is selected, automatically select it
    setSelectedChat((current) =>
      current ?? (newRecord.status === "unread" ? newRecord : null)
    )
  }, [])

  const handleUpdatedChat = useCallback((updatedRecord: any) => {
    if (!updatedRecord) return

    // Update in the list
    setChats((prev) =>
      prev.map((chat) => (chat.id === updatedRecord.id ? updatedRecord : chat))
    )

    // If this is the currently selected chat, update it
    setSelectedChat((current) =>
      current?.id === updatedRecord.id ? updatedRecord : current
    )
  }, [])

  const handleDeletedChat = useCallback((id?: string) => {
    if (!id) return

    // Remove from the list
    setChats((prev) => prev.filter((chat) => chat.id !== id))

    // If this is the currently selected chat, clear selection
    setSelectedChat((current) => (current?.id === id ? null : current))
  }, [])

  const setupRealtimeSubscription = useCallback(async () => {
    try {
      if (!programId) return

      const supabaseWithDeviceId = await withDeviceId()

      const subscription = supabaseWithDeviceId
        .channel("support_chats_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "support_chats",
            filter: `program_id=eq.${programId}`
          },
          (payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload

            // Handle different event types
            if (eventType === "INSERT") {
              // Add the new chat to the list
              handleNewChat(newRecord)
            } else if (eventType === "UPDATE") {
              // Update the changed chat in the list
              handleUpdatedChat(newRecord)
            } else if (eventType === "DELETE") {
              // Remove the deleted chat from the list
              handleDeletedChat(oldRecord?.id)
            }
          }
        )
        .subscribe()

      subscriptionRef.current = subscription
    } catch (error) {
      console.error("Error setting up realtime subscription:", error)
    }
  }, [handleDeletedChat, handleNewChat, handleUpdatedChat, programId])

  const fetchChats = useCallback(async () => {
    try {
      if (!programId) {
        setChats([])
        return
      }

      const supabaseWithDeviceId = await withDeviceId()
      const { data, error } = await makeRequest({
        table: "support_chats",
        isDebugMode,
        query: () =>
          supabaseWithDeviceId
            .from("support_chats")
            .select("*")
            .eq("program_id", programId)
            .order("created_at", { ascending: false })
      })

      if (error) throw error
      setChats(data || [])

      // Auto-select the first non-resolved chat if available and none selected
      setSelectedChat((current) => {
        if (current || !data || data.length === 0) return current
        const nonResolvedChats = data.filter(
          (chat: SupportChat) => chat.status !== "resolved"
        )
        return nonResolvedChats[0] ?? current
      })
    } catch (error) {
      console.error("Error fetching support chats:", error)
    } finally {
      setLoading(false)
    }
  }, [isDebugMode, programId])

  useEffect(() => {
    checkPermissions()
    fetchChats()
    setupRealtimeSubscription()

    // Cleanup subscription when component unmounts
    return () => {
      if (subscriptionRef.current.unsubscribe) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [checkPermissions, fetchChats, setupRealtimeSubscription])

  // Refetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("Support chats screen focused, fetching chats")
      fetchChats()
      return () => {
        // This runs when the screen is unfocused
        console.log("Support chats screen unfocused")
      }
    }, [fetchChats])
  )

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const supabaseWithDeviceId = await withDeviceId()
      const { error } = await makeRequest({
        table: "support_chats",
        isDebugMode,
        query: () =>
          supabaseWithDeviceId
            .from("support_chats")
            .update({ status: newStatus })
            .eq("id", id)
      })

      if (error) throw error

      // If resolving the currently selected chat, clear selection
      if (newStatus === "resolved" && selectedChat?.id === id) {
        setSelectedChat(null)
      }

      fetchChats()
    } catch (error) {
      console.error("Error updating chat status:", error)
    }
  }

  const handleReply = async () => {
    if (!selectedChat || !replyText.trim() || !programId) return

    try {
      // Add reply to chat history
      const updatedMessages = [
        ...(selectedChat.messages || []),
        {
          sender: "host",
          message: replyText,
          timestamp: new Date().toISOString()
        }
      ]

      const supabaseWithDeviceId = await withDeviceId()
      const { error } = await makeRequest({
        table: "support_chats",
        isDebugMode,
        query: () =>
          supabaseWithDeviceId
            .from("support_chats")
            .update({
              messages: updatedMessages,
              status: "replied"
            })
            .eq("id", selectedChat.id)
      })

      if (error) throw error

      // Send notification to the user
      try {
        await sendNotification({
          eventType: "support", // Assuming 'host' is the correct type for user-facing notifications
          programId,
          data: {
            title: `New reply in "${selectedChat.chat_title}"`,
            message: replyText,
            chatId: selectedChat.id, // Send chatId for navigation
            deviceId: selectedChat.device_id // Send deviceId to target the specific user
          }
        })
        console.log(
          `Sent support reply notification to device ${selectedChat.device_id}`
        )
      } catch (notifyError) {
        console.error("Error sending support reply notification:", notifyError)
        // Optionally handle notification errors, e.g., show an alert to the host
      }

      setReplyText("")
      fetchChats()

      // Update the selected chat with the new history
      setSelectedChat({
        ...selectedChat,
        messages: updatedMessages,
        status: "replied"
      })
    } catch (error) {
      console.error("Error sending reply:", error)
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

    // Mark as read if it's unread
    if (chat.status === "unread") {
      handleStatusUpdate(chat.id, "read")
    }
  }

  const handleResolveChat = (chatId: string) => {
    handleStatusUpdate(chatId, "resolved")
  }

  const renderChatItem = ({ item }: { item: SupportChat }) => (
    <TouchableOpacity
      style={[
        styles.chatCard,
        selectedChat?.id === item.id && styles.selectedChatCard
      ]}
      onPress={() => selectChat(item)}
    >
      <View style={styles.chatHeader}>
        <Text style={styles.userName}>{item.name || "Anonymous"}</Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === "unread"
                  ? theme.colors.warning
                  : item.status === "read"
                  ? theme.colors.primary
                  : theme.colors.success
            }
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color:
                  item.status === "unread"
                    ? getTextColorForBackground(theme.colors.warning)
                    : item.status === "read"
                    ? getTextColorForBackground(theme.colors.primary)
                    : getTextColorForBackground(theme.colors.success)
              }
            ]}
          >
            {item.status || "unread"}
          </Text>
        </View>
      </View>

      <Text style={styles.chatSubject}>{item.chat_title}</Text>
      <Text style={styles.chatPreview} numberOfLines={2}>
        {item.messages && item.messages.length > 0
          ? item.messages[item.messages.length - 1].message
          : "No messages yet"}
      </Text>
      <Text style={styles.timestamp}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>

      <TouchableOpacity
        style={styles.resolveButton}
        onPress={(e) => {
          e.stopPropagation()
          handleResolveChat(item.id)
        }}
      >
        <Text style={styles.resolveButtonText}>Resolve</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={getTextColorForBackground(theme.colors.primary)}
            />
          </TouchableOpacity>
          <Text style={styles.title}>
            {selectedChat ? selectedChat.chat_title : "Support Chats"}
          </Text>
          {isDebugMode && (
            <View style={styles.debugBadge}>
              <Text style={styles.debugText}>DEBUG</Text>
            </View>
          )}
          <TouchableOpacity onPress={openDrawer} style={{ padding: 8 }}>
            <Ionicons
              name="chatbubbles-outline"
              size={24}
              color={getTextColorForBackground(theme.colors.primary)}
            />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <Text style={styles.centeredText}>Loading support chats...</Text>
          </View>
        ) : filteredChats.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={theme.colors.text.secondary}
            />
            <Text style={styles.centeredText}>
              No active support chats found.
            </Text>
          </View>
        ) : selectedChat ? (
          <View style={styles.chatDetailContainer}>
            <FlatList
              data={selectedChat.messages || []}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.messageContainer,
                    item.sender === "host"
                      ? styles.hostMessage
                      : styles.userMessage
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color:
                        item.sender === "host"
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
                        item.sender === "host"
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
              keyExtractor={(item, index) => item.id || `msg-${index}`}
              contentContainerStyle={[
                styles.chatMessagesContainer,
                { flexGrow: 1, paddingBottom: 40 }
              ]}
              ref={flatListRef}
              onLayout={() => {
                if (selectedChat.messages?.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false })
                }
              }}
              onContentSizeChange={() => {
                if (selectedChat.messages?.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
              }}
              keyboardShouldPersistTaps="handled"
            />

            {canEditSupport ? (
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
                    color: theme.colors.text.primary
                  }}
                  value={replyText}
                  onChangeText={setReplyText}
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
                    opacity: !replyText.trim() ? 0.5 : 1
                  }}
                  onPress={handleReply}
                  disabled={!replyText.trim()}
                >
                  <Ionicons
                    name="send"
                    size={20}
                    color={getTextColorForBackground(theme.colors.primary)}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={{
                  padding: 10,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  alignItems: "center"
                }}
              >
                <Text style={{ color: theme.colors.text.secondary, fontSize: 14 }}>
                  You have read-only access to support chats
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.centered}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={theme.colors.text.secondary}
            />
            <Text style={styles.centeredText}>
              Select a chat to view the conversation
            </Text>
          </View>
        )}

        {/* Chat Drawer */}
        {drawerVisible && (
          <Animated.View
            style={[
              styles.drawer,
              { transform: [{ translateX: drawerAnimation }] }
            ]}
          >
            <View style={styles.drawerHeader}>
              <Text
                style={[
                  styles.drawerTitle,
                  { color: theme.colors.text.primary }
                ]}
              >
                Support Chats
              </Text>
              <TouchableOpacity onPress={closeDrawer}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.text.primary}
                />
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredChats}
              renderItem={renderChatItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.drawerList}
            />
          </Animated.View>
        )}

        {/* Overlay when drawer is open */}
        {drawerVisible && (
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={0.5}
            onPress={closeDrawer}
          />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
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
      alignItems: "center",
      padding: 16,
      backgroundColor: theme.colors.primary
    },
    backButton: {
      marginRight: 16
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: getTextColorForBackground(theme.colors.primary),
      flex: 1
    },
    debugBadge: {
      backgroundColor: theme.colors.error,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8
    },
    debugText: {
      color: getTextColorForBackground(theme.colors.error),
      fontSize: 12,
      fontWeight: "bold"
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 16
    },
    centeredText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.colors.text.secondary
    },
    drawer: {
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      width: 300,
      backgroundColor: theme.colors.surface,
      zIndex: 1000,
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 4
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      zIndex: 999
    },
    drawerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border || "#eee"
    },
    drawerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text.primary
    },
    drawerList: {
      padding: 8
    },
    chatCard: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border || "#eee",
      backgroundColor: theme.colors.surface,
      position: "relative"
    },
    selectedChatCard: {
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary
    },
    chatHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4
    },
    userName: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.colors.text.primary
    },
    statusBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10
    },
    statusText: {
      fontSize: 10,
      fontWeight: "500",
      textTransform: "capitalize"
    },
    chatSubject: {
      fontSize: 14,
      fontWeight: "bold",
      marginBottom: 4,
      color: theme.colors.text.primary
    },
    chatPreview: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: 4
    },
    timestamp: {
      fontSize: 10,
      color: theme.colors.text.secondary
    },
    resolveButton: {
      position: "absolute",
      right: 10,
      bottom: 10,
      backgroundColor: theme.colors.success,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 4
    },
    resolveButtonText: {
      color: getTextColorForBackground(theme.colors.success),
      fontSize: 12,
      fontWeight: "500"
    },
    chatDetailContainer: {
      flex: 1,
      padding: 16
    },
    chatMessagesContainer: {
      paddingVertical: 8
    },
    messageContainer: {
      maxWidth: "80%",
      padding: 12,
      borderRadius: 12,
      marginBottom: 8
    },
    userMessage: {
      backgroundColor: theme.colors.background,
      alignSelf: "flex-start",
      borderBottomLeftRadius: 4
    },
    hostMessage: {
      backgroundColor: theme.colors.primary,
      alignSelf: "flex-end",
      borderBottomRightRadius: 4
    }
  })
