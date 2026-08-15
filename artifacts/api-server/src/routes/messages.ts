import { Router } from "express";
import { db, conversationsTable, messagesTable, usersTable, stylistProfilesTable } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../lib/auth";
import { SendMessageBody, StartConversationBody } from "@workspace/api-zod";
import { sendNotification } from "../lib/notifications";
import { wasUploadedBy } from "../lib/upload-registry";
import { param } from "../lib/params";

const router = Router();

/**
 * Load a conversation and verify the authenticated user is a participant
 * (either the clientId or stylistId). Returns the conversation row or
 * sends an appropriate error response and returns null.
 */
async function requireParticipant(
  req: any,
  res: any,
  conversationId: string,
): Promise<typeof conversationsTable.$inferSelect | null> {
  const user = req.user;
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return null;
  }
  if (conv.clientId !== user.id && conv.stylistId !== user.id) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return conv;
}

function isOtherTyping(conv: typeof conversationsTable.$inferSelect, userId: string): boolean {
  const now = new Date();
  const isClient = conv.clientId === userId;
  // Client sees stylist typing; stylist sees client typing
  if (isClient) {
    return !!(conv.stylistTypingUntil && conv.stylistTypingUntil > now);
  }
  return !!(conv.clientTypingUntil && conv.clientTypingUntil > now);
}

function formatConv(
  c: typeof conversationsTable.$inferSelect,
  user: any,
  client: any,
  stylistProfile: any,
  stylistUser: any,
) {
  const unreadCount = c.stylistId === user.id ? c.stylistUnread : c.clientUnread;
  return {
    id: c.id,
    participants: [
      { id: client?.id ?? c.clientId, name: client?.name ?? "Client", role: "client", avatarUrl: client?.avatarUrl ?? null },
      { id: stylistUser?.id ?? c.stylistId, name: stylistProfile?.name ?? stylistUser?.name ?? "Stylist", role: "stylist", avatarUrl: stylistUser?.avatarUrl ?? null },
    ],
    lastMessage: c.lastMessage ?? null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    unreadCount,
    isOtherTyping: isOtherTyping(c, user.id),
    clientLastReadAt: c.clientLastReadAt?.toISOString() ?? null,
    stylistLastReadAt: c.stylistLastReadAt?.toISOString() ?? null,
  };
}

function serializeMessage(m: typeof messagesTable.$inferSelect) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId ?? null,
    senderName: m.senderName,
    content: m.content,
    messageType: m.messageType,
    mediaUrl: m.mediaUrl ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

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
    return formatConv(c, user, client, stylistProfile, stylistUser);
  }));

  res.json(result);
});

router.get("/messages/conversations/:conversationId", requireAuth, async (req, res) => {
  const conv = await requireParticipant(req, res, param(req.params.conversationId));
  if (!conv) return;

  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, param(req.params.conversationId)))
    .orderBy(messagesTable.createdAt);

  res.json(msgs.map(serializeMessage));
});

router.post("/messages/conversations/:conversationId/send", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation error" }); return; }

  const conv = await requireParticipant(req, res, param(req.params.conversationId));
  if (!conv) return;

  const messageType = (parsed.data as any).messageType ?? "text";
  const mediaUrl: string | null = (parsed.data as any).mediaUrl ?? null;

  // Validate media ownership: the mediaUrl must reference an object either
  // minted by this user's session, or already attached to a conversation
  // they participate in (e.g., re-sending an existing attachment).
  if (mediaUrl) {
    // Capture full /objects/... path (all segments) up to query string or fragment
    const objectPathMatch = mediaUrl.match(/\/objects\/[^?#]+/);
    if (objectPathMatch) {
      const objectPath = objectPathMatch[0];
      const ownedBySession = wasUploadedBy(objectPath, user.id);
      if (!ownedBySession) {
        const canAccess = await canAccessMediaObject(objectPath, user.id);
        if (!canAccess) {
          res.status(403).json({ error: "You do not have access to this media" });
          return;
        }
      }
    }
  }

  const [msg] = await db.insert(messagesTable).values({
    id: randomUUID(),
    conversationId: param(req.params.conversationId),
    senderId: user.id,
    senderName: user.name,
    content: parsed.data.content,
    messageType,
    mediaUrl,
  }).returning();

  const lastMessagePreview = messageType === "image" ? "📷 Image" : messageType === "voice" ? "🎤 Voice note" : parsed.data.content;
  const isClient = conv.clientId === user.id;

  await db.update(conversationsTable).set({
    lastMessage: lastMessagePreview,
    lastMessageAt: new Date(),
    ...(isClient ? { stylistUnread: conv.stylistUnread + 1 } : { clientUnread: conv.clientUnread + 1 }),
  }).where(eq(conversationsTable.id, param(req.params.conversationId)));

  res.status(201).json(serializeMessage(msg));

  // Send WhatsApp notification to recipient (non-fatal)
  setImmediate(async () => {
    try {
      const recipientId = isClient ? conv.stylistId : conv.clientId;
      const [recipientUser] = await db.select().from(usersTable).where(eq(usersTable.id, recipientId));
      if (recipientUser?.phone) {
        await sendNotification(recipientUser.phone, "message.received", {
          senderName: user.name,
          preview: lastMessagePreview,
        } as any);
      }
    } catch { /* non-fatal */ }
  });
});

router.post("/messages/conversations/:conversationId/typing", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const conv = await requireParticipant(req, res, param(req.params.conversationId));
  if (!conv) return;

  const typingUntil = new Date(Date.now() + 4000);
  const isClient = conv.clientId === user.id;
  const update = isClient ? { clientTypingUntil: typingUntil } : { stylistTypingUntil: typingUntil };

  await db.update(conversationsTable).set(update).where(eq(conversationsTable.id, param(req.params.conversationId)));
  res.status(204).end();
});

router.post("/messages/conversations/:conversationId/read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const conv = await requireParticipant(req, res, param(req.params.conversationId));
  if (!conv) return;

  const now = new Date();
  const isClient = conv.clientId === user.id;
  const update = isClient
    ? { clientUnread: 0, clientLastReadAt: now }
    : { stylistUnread: 0, stylistLastReadAt: now };

  await db.update(conversationsTable).set(update).where(eq(conversationsTable.id, param(req.params.conversationId)));
  res.status(204).end();
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
    const [client] = await db.select().from(usersTable).where(eq(usersTable.id, c.clientId));
    const [stylistProfile] = await db.select().from(stylistProfilesTable).where(eq(stylistProfilesTable.userId, c.stylistId));
    const [stylistUser] = await db.select().from(usersTable).where(eq(usersTable.id, c.stylistId));
    res.status(201).json(formatConv(c, user, client, stylistProfile, stylistUser));
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
    isOtherTyping: false,
    clientLastReadAt: null,
    stylistLastReadAt: null,
  });
});

/**
 * Verify that an objectPath (e.g. "/objects/some-uuid") belongs to a message
 * whose conversation includes the given userId, OR the object was minted for
 * that user (pre-send upload window). Checks ALL matching rows to avoid
 * authorization bypass via crafted/duplicate media_url rows.
 * Returns true (permissive) if no message references the object yet — covers
 * the window between upload and the send request; actual ownership was already
 * verified via the upload token store (wasUploadedBy) by callers.
 */
export async function canAccessMediaObject(objectPath: string, userId: string): Promise<boolean> {
  // Import wasUploadedBy here would cause a circular dep; callers use it directly.
  // This function handles the DB side of the check.
  const pattern = `%${objectPath}`;
  const matches = await db
    .select({ conversationId: messagesTable.conversationId })
    .from(messagesTable)
    .where(like(messagesTable.mediaUrl, pattern));

  // No message references this object yet — caller must check wasUploadedBy
  if (matches.length === 0) return false;

  // Check ALL matching conversations — user must be a participant in at least one
  const convChecks = await Promise.all(
    matches.map(async (m) => {
      const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, m.conversationId));
      return conv && (conv.clientId === userId || conv.stylistId === userId);
    }),
  );
  return convChecks.some(Boolean);
}

/**
 * Post a system message into a conversation between client and stylist.
 * Called internally by appointment status changes — not exposed as a public endpoint.
 */
export async function postSystemMessage(clientId: string, stylistId: string, content: string): Promise<void> {
  try {
    const convs = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.clientId, clientId), eq(conversationsTable.stylistId, stylistId)));

    if (!convs.length) return;

    const conv = convs[0];

    await db.insert(messagesTable).values({
      id: randomUUID(),
      conversationId: conv.id,
      senderId: null,
      senderName: "GlamNet",
      content,
      messageType: "system",
      mediaUrl: null,
    });

    await db.update(conversationsTable).set({
      lastMessage: content,
      lastMessageAt: new Date(),
      clientUnread: conv.clientUnread + 1,
      stylistUnread: conv.stylistUnread + 1,
    }).where(eq(conversationsTable.id, conv.id));
  } catch { /* non-fatal — booking notifications must not break the booking flow */ }
}

export default router;
