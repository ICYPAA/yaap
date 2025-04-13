import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useEffect, useRef, useState } from "react"
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
import { useDebug } from "../../../context/DebugContext"
import { useTheme } from "../../../context/ThemeContext"
import { makeRequest } from "../../../lib/requestHelper"
import { supabase } from "../../../lib/supabase"
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
  const [chats, setChats] = useState<SupportChat[]>([])
  const [filteredChats, setFilteredChats] = useState<SupportChat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null)
  const [replyText, setReplyText] = useState("")
  const [drawerVisible, setDrawerVisible] = useState(true)

  const drawerAnimation = useRef(new Animated.Value(0)).current
  const styles = React.useMemo(() => createStyles(theme), [theme])

  useEffect(() => {
    fetchChats()
  }, [])

  useEffect(() => {
    // Filter out resolved chats
    if (chats.length > 0) {
      const filteredResult = chats.filter((chat) => chat.status !== "resolved")
      setFilteredChats(filteredResult)
    }
  }, [chats])

  const fetchChats = async () => {
    try {
      const { data, error } = await makeRequest({
        table: "support_chats",
        isDebugMode,
        query: () =>
          supabase
            .from("support_chats")
            .select("*")
            .eq("program_id", 1)
            .order("created_at", { ascending: false })
      })

      if (error) throw error
      setChats(data || [])

      // Auto-select the first non-resolved chat if available and none selected
      if (data && data.length > 0 && !selectedChat) {
        const nonResolvedChats = data.filter(
          (chat) => chat.status !== "resolved"
        )
        if (nonResolvedChats.length > 0) {
          setSelectedChat(nonResolvedChats[0])
        }
      }
    } catch (error) {
      console.error("Error fetching support chats:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const { error } = await makeRequest({
        table: "support_chats",
        isDebugMode,
        query: () =>
          supabase
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
    if (!selectedChat || !replyText.trim()) return

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

      const { error } = await makeRequest({
        table: "support_chats",
        isDebugMode,
        query: () =>
          supabase
            .from("support_chats")
            .update({
              messages: updatedMessages,
              status: "replied"
            })
            .eq("id", selectedChat.id)
      })

      if (error) throw error

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
          <Text style={styles.statusText}>{item.status || "unread"}</Text>
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

  const ChatMessage = ({ message }: { message: ChatMessage }) => {
    const isHost = message.sender === "host"
    return (
      <View
        style={[
          styles.messageContainer,
          isHost ? styles.hostMessage : styles.userMessage
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isHost
              ? { color: getTextColorForBackground(theme.colors.primary) }
              : {}
          ]}
        >
          {message.message}
        </Text>
        <Text style={styles.messageTime}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
              data={[
                {
                  id: "initial",
                  sender: "user",
                  message: "Initial message",
                  timestamp: selectedChat.created_at
                },
                ...(selectedChat.messages || []).map((msg, idx) => ({
                  ...msg,
                  id: `msg-${idx}`
                }))
              ]}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.messageContainer,
                    item.sender === "host"
                      ? styles.hostMessage
                      : styles.userMessage
                  ]}
                >
                  <Text style={styles.messageText}>{item.message}</Text>
                  <Text style={styles.messageTime}>
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </Text>
                </View>
              )}
              keyExtractor={(item) => item.id || item.timestamp}
              contentContainerStyle={styles.chatMessagesContainer}
            />

            <View style={styles.replyContainer}>
              <TextInput
                style={styles.replyInput}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Type your reply..."
                placeholderTextColor={theme.colors.text.secondary}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !replyText.trim() && styles.disabledButton
                ]}
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
              <Text style={styles.drawerTitle}>Support Chats</Text>
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
      color: getTextColorForBackground(theme.colors.warning),
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
    },
    messageText: {
      fontSize: 14,
      color: theme.colors.text.primary
    },
    messageTime: {
      fontSize: 10,
      color: theme.colors.text.secondary,
      alignSelf: "flex-end",
      marginTop: 4
    },
    replyContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border || "#eee",
      paddingTop: 12
    },
    replyInput: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      maxHeight: 100,
      marginRight: 8,
      color: theme.colors.text.primary
    },
    sendButton: {
      backgroundColor: theme.colors.primary,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center"
    },
    disabledButton: {
      backgroundColor: theme.colors.disabled || "#cccccc"
    }
  })
