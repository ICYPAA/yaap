import { Ionicons } from "@expo/vector-icons"
import React, { useState } from "react"
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native"
import { theme } from "../../../constants/theme"

type Message = {
  id: string
  text: string
  sender: "user" | "support"
  timestamp: Date
}

// Mock chat data
const initialMessages: Message[] = [
  {
    id: "1",
    text: "Hello! How can we help you today?",
    sender: "support",
    timestamp: new Date()
  }
]

export default function SupportChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [newMessage, setNewMessage] = useState("")

  const handleSend = () => {
    if (!newMessage.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: newMessage,
      sender: "user",
      timestamp: new Date()
    }

    setMessages((prev) => [...prev, userMessage])
    setNewMessage("")

    // Simulate support response
    setTimeout(() => {
      const supportMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Thanks for your message. A support team member will respond shortly.",
        sender: "support",
        timestamp: new Date()
      }
      setMessages((prev) => [...prev, supportMessage])
    }, 1000)
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.sender === "user"
                ? styles.userMessage
                : styles.supportMessage
            ]}
          >
            <Text style={styles.messageText}>{item.text}</Text>
            <Text style={styles.timestamp}>
              {item.timestamp.toLocaleTimeString()}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.messageList}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type your message..."
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={!newMessage.trim()}
        >
          <Ionicons
            name="send"
            size={24}
            color={
              newMessage.trim() ? theme.colors.primary : theme.colors.border
            }
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  messageList: {
    padding: theme.spacing.md
  },
  messageBubble: {
    maxWidth: "80%",
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm
  },
  userMessage: {
    backgroundColor: theme.colors.primary,
    alignSelf: "flex-end"
  },
  supportMessage: {
    backgroundColor: theme.colors.surface,
    alignSelf: "flex-start"
  },
  messageText: {
    ...theme.typography.body,
    color: theme.colors.text.primary
  },
  timestamp: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs
  },
  inputContainer: {
    flexDirection: "row",
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.sm
  },
  sendButton: {
    justifyContent: "center",
    padding: theme.spacing.xs
  }
})
