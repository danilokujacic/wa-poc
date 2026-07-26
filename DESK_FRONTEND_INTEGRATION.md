# Live Messages Desk — messages integration

Assumes auth, CORS, and the base connection are already wired up. This covers only the desk
messaging surface: conversation/message REST endpoints, the WebSocket event, and how they fit
together. All shapes are taken directly from the backend source.

## REST endpoints

All under `/resort/:resortId/desk`, requiring the existing authenticated session (owner or
employee of that resort).

### `GET /resort/:resortId/desk/conversations`
List every conversation for the resort, most-recently-updated first.
Response `200`, array of:
```json
{
  "id": "uuid",
  "guestPhoneNumber": "38269280401",
  "status": "Bot" | "Human" | "Closed",
  "assignedUserId": "uuid" | null,
  "createdAt": "2026-01-01T12:00:00.000Z",
  "updatedAt": "2026-01-01T12:05:00.000Z"
}
```
- `"Bot"` — AI is answering automatically.
- `"Human"` — an employee (`assignedUserId`) has taken it over; AI is silenced for it.
- `"Closed"` — resolved; reopens to `"Bot"` automatically the instant the guest sends a new
  message (no frontend action needed for that transition — just react to the `newMessage` event's
  `conversationStatus` field, see below).

### `GET /resort/:resortId/desk/conversations/:id/messages`
Full message history for one conversation, oldest first.
Response `200`, array of:
```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "sender": "Guest" | "Ai" | "Employee",
  "body": "the message text",
  "sentByUserId": "uuid" | null,
  "createdAt": "2026-01-01T12:00:00.000Z"
}
```
`sentByUserId` is only non-null for `sender: "Employee"` messages.

### `PATCH /resort/:resortId/desk/conversations/:id/claim`
No body. Marks the conversation `status: "Human"`, `assignedUserId` = the calling user's id.
Response `200`: the updated conversation object (same shape as the list endpoint). Call this
when an employee clicks "take over".

### `PATCH /resort/:resortId/desk/conversations/:id/close`
No body. Marks the conversation `status: "Closed"`. Response `200`: the updated conversation
object.

### `POST /resort/:resortId/desk/conversations/:id/messages`
Send a reply to the guest **as the logged-in employee** — this actually delivers the message to
the guest over WhatsApp (not just a local note) and records it.
Body:
```json
{ "body": "Thanks for reaching out — let me check on that for you." }
```
(`body`: string, 1–4096 chars, required — invalid/missing returns `400`.)
Response `200`: the created message object (same shape as the messages-list endpoint, with
`sender: "Employee"`).

Errors follow Nest's default shape: `404` for missing conversation/resort, `400` for validation
failures, `403` if the session's resort doesn't match `:resortId`.

## WebSocket: the `newMessage` event

Namespace: `/desk` (you said the connection is already established — this is just the event to
listen for). No "join conversation" step exists; you receive events for **every** conversation in
your resort automatically, scoped server-side by a room per resort. Filter client-side by
`conversationId` if you're only rendering one open thread.

```ts
socket.on("newMessage", (payload) => {
  // shape below
});
```

Payload — **note this is not identical to the REST message shape above**, field names differ:
```json
{
  "conversationId": "uuid",
  "messageId": "uuid",
  "sender": "Guest" | "Ai" | "Employee",
  "body": "the message text",
  "createdAt": "2026-01-01T12:00:00.000Z",
  "conversationStatus": "Bot" | "Human" | "Closed"
}
```

This one event fires for the entire message lifecycle — guest inbound messages, AI replies, and
employee replies all go through it. Use `sender` to style each differently, and
`conversationStatus` to keep your local conversation-list state in sync (bump it to the top,
update its status badge) without re-fetching `GET .../conversations`.

There is **no other event** — no `conversationCreated`, no `conversationClosed`, etc. A brand-new
conversation is signaled the same way: the first `newMessage` you get for a `conversationId` you
haven't seen before **is** the new conversation. Either insert it into your list locally from the
payload, or re-fetch `GET .../conversations` if you'd rather not maintain that merge logic.

There's no outbound socket event — claim/close/reply all go through the REST endpoints above, not
through the socket. The socket is a push-only channel for `newMessage`.

## Suggested flow

1. `GET /resort/:resortId/desk/conversations` to render the list.
2. On opening a conversation, `GET .../conversations/:id/messages` for history, then append as
   `newMessage` events arrive for that `conversationId`.
3. Take-over/close/reply buttons call their REST endpoints; update the UI optimistically from the
   REST response rather than waiting for the socket round-trip — the `newMessage` event for your
   own action will also arrive shortly after, so dedupe by `id`/`messageId`.

## Not built yet — don't assume these exist

- No pagination on either list endpoint (both return everything).
- No endpoint to fetch a single conversation by id.
- No typing indicators or read receipts.
- No way to un-claim back to `Bot` without closing (`Bot` only returns automatically when a
  *guest* messages a closed conversation).
- `assignedUserId`/`sentByUserId` are raw ids only — cross-reference `GET /resort/:resortId/user`
  client-side if you need names.
