import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().references(() => usersTable.id),
  stylistId: text("stylist_id").notNull(),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  clientUnread: integer("client_unread").notNull().default(0),
  stylistUnread: integer("stylist_unread").notNull().default(0),
  clientLastReadAt: timestamp("client_last_read_at"),
  stylistLastReadAt: timestamp("stylist_last_read_at"),
  clientTypingUntil: timestamp("client_typing_until"),
  stylistTypingUntil: timestamp("stylist_typing_until"),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").references(() => usersTable.id),
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("text"),
  mediaUrl: text("media_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
