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
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => usersTable.id),
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
