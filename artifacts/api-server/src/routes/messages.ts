import { Router } from "express";
import { db, conversationsTable, messagesTable, usersTable, stylistProfilesTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { SendMessageBody, StartConversationBody } from "@workspace/api-zod";

const router = Router();

router.get("/messages/conversations", requireAuth, async (req, res) => {
  const user = (req as any).user;
  let convs;
  if (user.role === "stylist") {
    convs = await db.select().from(conversationsTable).where(eq(conversationsTable.stylistId, user.id));
  } else {
    convs = await db.select().from(conversationsTable).where(eq(conversationsTable.clientId, user.id));
  }

  const result = await Promise.all(convs.map(async (c) => {
    const [client] = await db.select().from(usersTable).where(eq(usersTable.id, c.clientId));
    const [stylistProfile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, c.stylistId));
    const [stylistUser] = await db.select().from(usersTable).where(eq(usersTable.id, c.stylistId));

    const unreadCount = user.role === "stylist" ? c.stylistUnread : c.clientUnread;

    return {
      id: c.id,
      participants: [
        { id: client?.id ?? c.clientId, name: client?.name ?? "Client", role: "client", avatarUrl: client?.avatarUrl ?? null },
        { id: stylistUser?.id ?? c.stylistId, name: stylistProfile?.name ?? stylistUser?.name ?? "Stylist", role: "stylist", avatarUrl: stylistUser?.avatarUrl ?? null },
      ],
      lastMessage: c.lastMessage ?? null,
      lastMessageAt: c.lastMessageAt.toISOString(),
      unreadCount,
    };
  }));

  res.json(result);
});

router.get("/messages/conversations/:conversationId", requireAuth, async (req, res) => {
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, req.params.conversationId))
    .orderBy(messagesTable.createdAt);

  res.json(msgs.map(m => ({
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    senderName: m.senderName,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  })));
});

router.post("/messages/conversations/:conversationId/send", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, req.params.conversationId));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [msg] = await db.insert(messagesTable).values({
    id: randomUUID(),
    conversationId: req.params.conversationId,
    senderId: user.id,
    senderName: user.name,
    content: parsed.data.content,
  }).returning();

  await db.update(conversationsTable).set({
    lastMessage: parsed.data.content,
    lastMessageAt: new Date(),
    ...(user.role === "stylist" ? { clientUnread: conv.clientUnread + 1 } : { stylistUnread: conv.stylistUnread + 1 }),
  }).where(eq(conversationsTable.id, req.params.conversationId));

  res.status(201).json({
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    senderName: msg.senderName,
    content: msg.content,
    createdAt: msg.createdAt.toISOString(),
  });
});

router.post("/messages/start", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = StartConversationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }

  const { stylistId } = parsed.data;

  const existing = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.clientId, user.id), eq(conversationsTable.stylistId, stylistId)));

  if (existing.length > 0) {
    const c = existing[0];
    res.status(201).json({
      id: c.id,
      participants: [],
      lastMessage: c.lastMessage ?? null,
      lastMessageAt: c.lastMessageAt.toISOString(),
      unreadCount: c.clientUnread,
    });
    return;
  }

  const [conv] = await db.insert(conversationsTable).values({
    id: randomUUID(),
    clientId: user.id,
    stylistId,
  }).returning();

  res.status(201).json({
    id: conv.id,
    participants: [],
    lastMessage: null,
    lastMessageAt: conv.lastMessageAt.toISOString(),
    unreadCount: 0,
  });
});

export default router;
