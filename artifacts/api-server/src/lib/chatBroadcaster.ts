/**
 * In-memory SSE broadcaster for real-time chat events.
 *
 * Each connected client subscribes by userId. When a relevant event occurs
 * (new message, typing update, read receipt), the route handler calls
 * broadcast(userId, event) to push it to all of that user's open SSE connections
 * (they may have multiple tabs open).
 *
 * SSE Ticket store
 * ----------------
 * EventSource cannot set custom headers, so the long-lived Bearer token must
 * NOT appear in the URL. Instead, the client first POSTs (with its normal
 * Authorization header) to /messages/sse-ticket to receive a short-lived,
 * single-use ticket. That ticket is passed as ?ticket=... when opening the
 * EventSource. Once consumed or expired it is deleted.
 */

import type { Response } from "express";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// SSE ticket store
// ---------------------------------------------------------------------------

interface Ticket {
  userId: string;
  expiresAt: number; // ms since epoch
}

const tickets = new Map<string, Ticket>();
const TICKET_TTL_MS = 30_000; // 30 seconds — enough time to open EventSource

/** Mint a new single-use ticket for the given user. Returns the opaque string. */
export function mintSseTicket(userId: string): string {
  const ticket = randomBytes(32).toString("hex");
  tickets.set(ticket, { userId, expiresAt: Date.now() + TICKET_TTL_MS });
  // Prune expired tickets lazily
  for (const [k, v] of tickets) {
    if (v.expiresAt < Date.now() && k !== ticket) tickets.delete(k);
  }
  return ticket;
}

/**
 * Consume a ticket: returns the userId if the ticket is valid and not expired,
 * then deletes it so it cannot be replayed.
 */
export function consumeSseTicket(ticket: string): string | null {
  const entry = tickets.get(ticket);
  tickets.delete(ticket); // always delete — no replay regardless of validity
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) return null;
  return entry.userId;
}

export type ChatEvent =
  | { type: "message"; conversationId: string; message: Record<string, unknown> }
  | { type: "conversation"; conversation: Record<string, unknown> }
  | { type: "ping" };

interface SseClient {
  res: Response;
  userId: string;
}

// userId -> Set of active SSE connections
const clients = new Map<string, Set<SseClient>>();

export function addClient(userId: string, res: Response): SseClient {
  const client: SseClient = { res, userId };
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(client);
  return client;
}

export function removeClient(userId: string, client: SseClient): void {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) clients.delete(userId);
}

export function revokeUserStreams(userId: string): void {
  const set = clients.get(userId);
  if (!set) return;
  clients.delete(userId);
  for (const client of set) {
    try { client.res.end(); } catch { /* already closed */ }
  }
}

export function broadcast(userId: string, event: ChatEvent): void {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(event);
  for (const client of set) {
    try {
      client.res.write(`event: chat\ndata: ${data}\n\n`);
    } catch {
      // Connection likely closed; cleanup happens via the 'close' event
    }
  }
}

/** Broadcast to multiple user IDs at once (e.g. both participants). */
export function broadcastToUsers(userIds: string[], event: ChatEvent): void {
  for (const uid of userIds) broadcast(uid, event);
}
