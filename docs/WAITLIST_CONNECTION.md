# Connecting the Vercel waitlist to Bonisa

The Bonisa owner portal has an **Artist Contacts** list that combines everyone
from the Bonisa app, the Vercel waitlist and people the owner adds by hand. It
reminds anyone who is missing something, automatically, by email and WhatsApp.

For waitlist sign-ups to appear there on their own, Supabase needs to tell
Bonisa each time someone joins. No change to the Vercel site's code is needed.

## 1. Choose a secret (Bonisa side, Replit)

Add a secret called `WAITLIST_WEBHOOK_SECRET` to the Bonisa Replit app. Any long
random string works, for example one from a password generator. Share it with
whoever sets up step 2.

Also set `PUBLIC_APP_URL` to the live Bonisa address (for example
`https://bonisa.co.za`). Reminders use it for the sign-up and profile links.

## 2. Add a database webhook (Supabase, for Hayden)

In the Supabase project that stores the waitlist:

1. Go to **Database → Webhooks** (sometimes under **Integrations → Database Webhooks**) and choose **Create a new hook**.
2. **Table:** the waitlist table.
3. **Events:** Insert. Update too, if people can edit their sign-up.
4. **Type:** HTTP Request. **Method:** POST.
5. **URL:** `https://<live Bonisa address>/api/integrations/waitlist`
6. **HTTP Headers:** add `x-bonisa-secret` with the value from step 1.
7. Save.

Bonisa reads column names loosely, so `name`, `full_name`, or `first_name` plus
`last_name` all work, as do `email`, `phone`/`phone_number`/`whatsapp`/`mobile`,
`city`/`location`/`area`/`province` and `specialty`/`category`/`service`. The
full original row is kept with the contact for reference.

If the site posts sign-ups itself instead, it can send the same request with a
plain JSON body of the sign-up fields and the same header.

## 3. Bring in everyone who signed up before today

In Supabase, open the waitlist table in the **Table Editor**, choose **Export →
CSV**, then in Bonisa go to **Owner portal → Artist Contacts → Import**, pick
**Vercel waitlist** and upload the file. People already on the list are matched
by email or phone, not duplicated, so importing twice is safe.

## How people are matched

Email (ignoring capitals) first, then phone number (`082 123 4567`,
`+27821234567` and `27821234567` are treated as the same number). When a
waitlist person later signs up in the app with the same email or phone, her
contact links to her account automatically and her reminders switch from
"create your profile" to naming the exact items she is still missing.
