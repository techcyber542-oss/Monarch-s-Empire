# Monarchs Empire

A Solo Leveling-inspired dark fantasy community chat starter built with React, TypeScript, Vite, and Supabase.

## What's included

- Responsive liquid-glass interface with violet/blue theme, animated ambient light, rune/magic details, and reduced-motion setting
- Channel navigation, live connection indicator, member/quest/realm panels
- Anonymous Supabase sign-in, profile name/status/avatar/banner URLs, avatar aura options
- Message composer, emoji picker, sticker picker, image upload hook, replies, edit/delete menus, reactions, pinning, reports UI, and slash commands
- Owner/moderator console UI with database-backed role policy examples
- Supabase Realtime subscription for message INSERT/UPDATE/DELETE
- Demo preview works without Supabase, but messages are local only

## Setup

1. Create a **new** Supabase project. Keep it separate from any existing project.
2. In Supabase → SQL Editor, run `supabase/schema.sql`.
3. In Supabase → Authentication → Sign In / Providers, enable **Anonymous Sign-ins**.
4. In Supabase → Project Settings → API, copy the Project URL and publishable/anon key.
5. Copy `.env.example` to `.env.local` and fill in the values:
   ```env
   VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```
6. Install and run:
   ```bash
   npm install
   npm run dev
   ```
7. Confirm `npm run build` succeeds, then push the project to a new GitHub repository and import that repository into Vercel. Add the two environment variables in Vercel Project Settings → Environment Variables, then redeploy.

## Grant the first owner

Create an account/profile through the app once. Then, in Supabase SQL Editor, run this query with your actual username:

```sql
update public.profiles
set role = 'owner'
where username = 'YOUR_USERNAME';
```

Sign out and back in / reload to fetch the new role. **Do not expose a service-role key in the frontend.** Only trusted project admins should grant roles through the SQL editor.

## Storage bucket for image uploads

Create a Storage bucket named `chat-media`. For a public starter bucket, enable public reads, but only allow authenticated users to upload to their own user-id folder. For production, prefer private storage and signed URLs. Example authenticated insert policy for the bucket's `storage.objects` table:

```sql
create policy "Members upload to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

The UI uses public URLs in this starter, so the bucket must be public for uploaded images to display. Do not upload private/sensitive images.

## Important starter limitations

This is a substantial starter foundation, not a fully audited production Discord clone. In this first version:
- Emoji reactions and pinning are in local UI state; persist them with `message_reactions` and a dedicated pins table before treating them as durable.
- Reports are shown in the current session; wire the report action to `message_reports` to persist and review them.
- Slash command `/clear` is view-clearing for members; owner room clearing uses database updates.
- Presence count is illustrative until a Supabase Presence channel is added.
- Profile image/banner URLs can be entered in settings; upload UI for these can be added using the same Storage bucket.
- Animated profile-picture files can be displayed via a GIF/WebP URL; this starter does not transcode or host animation itself.
- 60–120 FPS cannot be guaranteed by a website. The CSS uses transform/opacity animations and avoids continuous canvas effects, but actual frame rate depends on device, browser, and power mode. On mobile, use Settings → Reduce motion if needed.
- The SQL policies should be reviewed and tested before a public launch. Use server-enforced permissions, not frontend role labels, for every privileged action.

## Slash commands

- `/help` — show command help
- `/clear` — open the clear-chat confirmation
- `/announce your message` — moderators/owners only
- `/report` — directs you to message report controls

## Deployment

Use a public Vercel production deployment. Do not enable Vercel Deployment Protection on the production URL if ordinary visitors should access it.
