# Bonisa Pixel Arcade + waitlist

A playable pixel game with a waitlist form on the same page. Everyone who joins
lands in **Owner portal > Artist Contacts**, next to everyone else.

## What was added

| What | Where |
|---|---|
| The game and the waitlist form | `artifacts/glamnet/public/play/index.html` (opens at `/play/`) |
| The form's server endpoint | `artifacts/api-server/src/routes/public-waitlist.ts` (`POST /api/public/waitlist`) |

## How to put it live

1. Merge this branch (it is built on top of the artist waitlist branch, which
   already has the Artist Contacts list).
2. Publish the Bonisa app as usual.
3. Open `<live address>/play/` on your phone, play a round, and join the
   waitlist with your own number as a test.
4. Check **Owner portal > Artist Contacts**. You should appear within a few seconds.
5. Share the `/play/` link in the Bonisa Group.

No new secrets or database changes are needed.

## What happens to each sign-up

- **Artists** are added as a normal contact and get the usual friendly reminders.
- **Clients and brands** are saved too, but with reminders switched off, so they
  never get "create your artist profile" emails.
- The same person joining twice is merged, not duplicated (matched by email or phone).
- Each row keeps a note such as "Joined the waitlist from the Pixel Arcade as artist (game score 12)",
  plus the time and that she ticked the consent box.
- In the contacts list the source shows as "Vercel waitlist". That is the
  existing label for waitlist sign-ups.

## Safety

- A consent tick is required before anything is saved.
- A hidden field catches simple bots; their sign-ups are quietly ignored.
- Each internet address can send 8 sign-ups per hour.
- Whether someone is new or already on the list, she sees the same "You are on the list" message.

## Not done yet

- A link to a privacy policy next to the consent tick (that lives on the legal branch).
- A leaderboard. It would need real saved scores, and the project rule is no made-up data.
