# Fire Department Training Management

GitHub Pages front end for a firefighter training portal.

## Live project connection

The frontend configuration in `assets/supabase-config.js` points to the dedicated firefighter-management Supabase project:

- Project reference: `scvflimmbpxycrerikzg`
- Project URL: `https://scvflimmbpxycrerikzg.supabase.co`
- GitHub Pages: `https://clydejr1992.github.io/firefirghter-training-management/`

Do not substitute credentials from Fuel the Fire or any other project. Browser code must use only the publishable/anon key. Never put a service-role or secret key in this repository.

## Backend provisioned

The dedicated project has the profile table, training records, training events, training requirements, department bulletins, member messages, and administrator audit-log tables. Row-level security is enabled. Firefighter records and messages are scoped to their owner; management writes are restricted to an active administrator. The `firefighter-certificates` storage bucket is private.

The `admin-user-management` Edge Function is deployed with JWT verification enabled. It supports administrator-authorized invitations and password-reset requests.

## Required before real department use

1. Configure Supabase Auth's Site URL and allowed redirect URL to `https://clydejr1992.github.io/firefirghter-training-management/`.
2. Create/confirm the initial administrator's Auth account, then create the matching `public.firefighter_profiles` row with `role = 'admin'` and `active = true`. Never grant admin based on client-submitted profile data. Do not share passwords or secret keys.
3. Confirm Supabase email delivery/SMTP works for invitations and password resets.
4. Test admin sign-in, firefighter sign-in, invitations, recovery links, member isolation, training create/read, bulletin/message access, and certificate uploads.
5. Finish wiring the certificate scanner to persist original scans in the private bucket and associate the private object path with the training record before relying on certificate archiving.
6. Test on the published GitHub Pages site. The existence of tables and a deployed function does not by itself prove all frontend workflows are working.

## Security notes

- RLS is enabled for every application table in the public schema.
- Members may read their own profile, training records, and messages; department events, requirements, and bulletins are readable by signed-in members.
- Administrator write actions are guarded by the server-side active-admin check.
- Certificate storage is private and currently administrator-only.
- Email delivery depends on Supabase Auth email configuration.
- Do not use real member data until the initial admin account and end-to-end access tests are complete.
