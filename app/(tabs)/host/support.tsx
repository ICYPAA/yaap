import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useEffect, useState } from "react"
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { useDebug } from "../../../context/DebugContext"
import { makeRequest } from "../../../lib/requestHelper"
import { supabase } from "../../../lib/supabase"

interface ChatMessage {
  id?: string
  sender: string
  message: string
  timestamp: string
}

interface SupportChat {
  id: string
  profiles?: {
    full_name: string
    email: string
  }
  subject: string
  initial_message: string
  chat_history?: ChatMessage[]
  status: string
  created_at: string
}

export default function SupportChats() {
  const router = useRouter()
  const { isDebugMode } = useDebug()
  const [chats, setChats] = useState<SupportChat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null)
  const [replyText, setReplyText] = useState("")

  useEffect(() => {
    fetchChats()
  }, [])

  const fetchChats = async () => {
    try {
      const { data, error } = await makeRequest({
        table: "support_chats",
        isDebugMode,
        query: () =>
          supabase
            .from("support_chats")
            .select("*, profiles(full_name, email)")
            .order("created_at", { ascending: false })
      })

      if (error) throw error
      setChats(data || [])
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
      fetchChats()
    } catch (error) {
      console.error("Error updating chat status:", error)
    }
  }

  const handleReply = async () => {
    if (!selectedChat || !replyText.trim()) return

    try {
      // Add reply to chat history
      const updatedHistory = [
        ...(selectedChat.chat_history || []),
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
              chat_history: updatedHistory,
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
        chat_history: updatedHistory,
        status: "replied"
      })
    } catch (error) {
      console.error("Error sending reply:", error)
    }
  }

  const renderChatItem = ({ item }: { item: SupportChat }) => (
    <TouchableOpacity
      style={[
        styles.chatCard,
        selectedChat?.id === item.id && styles.selectedChatCard
      ]}
      onPress={() => setSelectedChat(item)}
    >
      <View style={styles.chatHeader}>
        <Text style={styles.userName}>
          {item.profiles?.full_name || "Anonymous"}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === "unread"
                  ? "#e74c3c"
                  : item.status === "read"
                  ? "#f39c12"
                  : "#2ecc71"
            }
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.chatSubject}>{item.subject}</Text>
      <Text style={styles.chatPreview} numberOfLines={2}>
        {item.chat_history && item.chat_history.length > 0
          ? item.chat_history[item.chat_history.length - 1].message
          : item.initial_message}
      </Text>
      <Text style={styles.timestamp}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>

      {item.status === "unread" && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: "#f39c12" }]}
          onPress={() => handleStatusUpdate(item.id, "read")}
        >
          <Text style={styles.actionButtonText}>Mark as Read</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )

  const renderChatDetail = () => {
    if (!selectedChat) return null

    return (
      <View style={styles.chatDetailContainer}>
        <View style={styles.chatDetailHeader}>
          <Text style={styles.chatDetailTitle}>{selectedChat.subject}</Text>
          <Text style={styles.chatDetailSubtitle}>
            Conversation with {selectedChat.profiles?.full_name || "Anonymous"}
          </Text>
        </View>

        <FlatList
          data={[
            {
              id: "initial",
              sender: "user",
              message: selectedChat.initial_message,
              timestamp: selectedChat.created_at
            },
            ...(selectedChat.chat_history || []).map((msg, idx) => ({
              ...msg,
              id: `msg-${idx}`
            }))
          ]}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageContainer,
                item.sender === "host" ? styles.hostMessage : styles.userMessage
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
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.chatMessagesContainer}
        />

        <View style={styles.replyContainer}>
          <TextInput
            style={styles.replyInput}
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Type your reply..."
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
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Support Chats</Text>
        {isDebugMode && (
          <View style={styles.debugBadge}>
            <Text style={styles.debugText}>DEBUG</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text>Loading support chats...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.chatListContainer}>
            {chats.length === 0 ? (
              <View style={styles.centered}>
                <Text>No support chats found.</Text>
              </View>
            ) : (
              <FlatList
                data={chats}
                renderItem={renderChatItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContainer}
              />
            )}
          </View>

          {selectedChat ? (
            renderChatDetail()
          ) : (
            <View style={styles.noChatSelected}>
              <Ionicons name="chatbubbles-outline" size={48} color="#bdc3c7" />
              <Text style={styles.noChatText}>
                Select a chat to view the conversation
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#3498db"
  },
  backButton: {
    marginRight: 16
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    flex: 1
  },
  debugBadge: {
    backgroundColor: "#e74c3c",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  debugText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold"
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  content: {
    flex: 1,
    flexDirection: "row"
  },
  chatListContainer: {
    width: "40%",
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0"
  },
  listContainer: {
    padding: 8
  },
  chatCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1
  },
  selectedChatCard: {
    backgroundColor: "#ecf0f1",
    borderLeftWidth: 4,
    borderLeftColor: "#3498db"
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4
  },
  userName: {
    fontSize: 16,
    fontWeight: "500"
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10
  },
  statusText: {
    color: "white",
    fontSize: 10,
    fontWeight: "500",
    textTransform: "capitalize"
  },
  chatSubject: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4
  },
  chatPreview: {
    fontSize: 12,
    color: "#7f8c8d",
    marginBottom: 4
  },
  timestamp: {
    fontSize: 10,
    color: "#95a5a6",
    marginBottom: 8
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: "flex-end"
  },
  actionButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500"
  },
  chatDetailContainer: {
    flex: 1,
    padding: 16
  },
  noChatSelected: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  noChatText: {
    marginTop: 16,
    color: "#7f8c8d",
    fontSize: 16
  },
  chatDetailHeader: {
    marginBottom: 16
  },
  chatDetailTitle: {
    fontSize: 20,
    fontWeight: "bold"
  },
  chatDetailSubtitle: {
    fontSize: 14,
    color: "#7f8c8d"
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
    backgroundColor: "#e8f4fd",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4
  },
  hostMessage: {
    backgroundColor: "#dcf8c6",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4
  },
  messageText: {
    fontSize: 14
  },
  messageTime: {
    fontSize: 10,
    color: "#7f8c8d",
    alignSelf: "flex-end",
    marginTop: 4
  },
  replyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 8
  },
  replyInput: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100
  },
  sendButton: {
    backgroundColor: "#3498db",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8
  },
  disabledButton: {
    backgroundColor: "#bdc3c7"
  }
})
