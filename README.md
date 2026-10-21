# Fire Department Training Management

GitHub Pages front end for a firefighter training portal.

## Included in this repository
- Responsive firefighter-themed sign-in landing page.
- Separate firefighter and administrator sign-in selection.
- Session-aware front-end wiring for Supabase Auth.
- Administrator-only invitation and password-reset form UI.
- SQL foundation for firefighter profiles and row-level security.
- Server-side Edge Function source for admin-authorized invitations and reset requests.

## Important: not live until backend setup is complete
This repository does **not** contain credentials or a live authentication backend configuration. Until the department's dedicated Supabase project is configured, the login button stays disabled. There are no hardcoded demo accounts.

Do not use the existing school inventory project's Supabase credentials for this portal. Use a dedicated firefighter-management project.

## Setup checklist
1. In a dedicated Supabase project, run `supabase/schema.sql` in the SQL editor.
2. Promote the intended initial administrator securely: create/verify their Auth user, then add a matching row to `public.firefighter_profiles` with `role = 'admin'` and `active = true`. Do not grant admin based on a client-submitted field.
3. Copy the project's Project URL and publishable/anon key into `assets/supabase-config.js`. Never put a `service_role` key in browser code.
4. Configure Supabase Auth email templates and allowed redirect URLs for the GitHub Pages URL:
   `https://clydejr1992.github.io/firefirghter-training-management/`
5. Deploy `supabase/functions/admin-user-management/index.ts` as an Edge Function named `admin-user-management`, with JWT verification enabled.
6. Set the Edge Function secret `PORTAL_REDIRECT_URL` to the exact GitHub Pages URL above. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Edge Functions. Keep service-role secrets server-side only.
7. Test with a non-admin account and an admin account. Confirm users cannot read other profiles, non-admins cannot invite/reset users, invitation links are one-time, and recovery links permit the user to choose their own password.

## Security notes
- The profile table only permits a signed-in user to read their own profile; browser-side profile writes are intentionally not granted.
- Admin actions verify the caller's JWT and active admin role on the server.
- Email sending depends on Supabase Auth SMTP/email configuration and deliverability.
- The main training records, certificate storage, calendar, bulletins, audit records, and member-specific data still need their own tables, storage policies, and role-based RLS before the portal should be used with real department records. A hidden UI alone is not authorization.
- Never upload certificate images or other private records to a public bucket.
