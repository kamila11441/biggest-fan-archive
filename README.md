[README.md](https://github.com/user-attachments/files/33499444/README.md)# Biggest Fan Archive

A personal appreciation website for רואי, built with plain HTML/CSS/JavaScript and hosted on GitHub Pages. Shared content, protected administration, and shared visitor comments use Supabase (hosted Postgres + Auth). GitHub login is not required for visitors.

## Files

- `index.html`, `styles.css`, `public-app.js` — public site and shared content integration
- `admin.html`, `admin.css`, `admin-app.js` — authenticated content management, editing, backup, and moderation
- `backend-config.js` — **public** Supabase project URL and anon key (safe to publish when Row Level Security is enabled)
- `supabase-schema.sql` — database tables, grants, and Row Level Security policies
- Supabase Storage bucket `archive-photos` — public photo delivery with authenticated admin uploads
- `assets/` — optional locally hosted site assets

## One-time backend setup (required)

GitHub Pages cannot run a private server or protect an admin page on its own. This project uses Supabase Auth and Postgres. The HTML/JS files are public, but the database policies enforce which operations visitors and authenticated users can perform.

1. Create a project at [Supabase](https://supabase.com/) and wait for its database to finish provisioning.
2. In the Supabase dashboard, open **SQL Editor**, paste all of `supabase-schema.sql`, and run it. This creates the database policies and the `archive-photos` storage bucket used by the photo journal.
3. Open **Project Settings → API** (or **Connect**) and copy the project URL and **anon / publishable** key. Do not use a `service_role` or secret key in this website.
4. Put those two public values in `backend-config.js`:

   ```js
   window.ARCHIVE_BACKEND = {
     supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
     supabaseAnonKey: 'YOUR_PUBLIC_ANON_KEY'
   };
   ```

5. In **Authentication → Providers**, enable Email/Password. In **Authentication → URL Configuration**, add your deployed GitHub Pages URL as a Site URL and redirect URL.
6. In **Authentication → Users**, create the admin user yourself. Disable public sign-ups in Authentication settings; do not give visitors admin accounts. Use a unique, strong password and enable MFA in Supabase if available for your project.
7. Upload all files to the root of your GitHub Pages repository. Keep `backend-config.js` in the root next to `index.html`.
8. Open `/admin.html`, sign in using the user you created, and publish content. The public page loads the latest saved content from the database.

### Security notes

- Never commit a Supabase `service_role` key, database password, or other secret to this repository.
- The anon/publishable key is expected to be visible in the browser. **RLS policies are the security boundary.** Review policies if you customize the database.
- Supabase Auth only grants access to authenticated users. Disable public account creation and create only trusted admin users. For a higher-security multi-admin deployment, add an explicit admin-role table/policy rather than allowing every authenticated user to moderate content.
- Visitor comments are stored as pending (`approved=false`). Only approved comments are shown publicly. An authenticated admin can approve or delete comments in the admin page.
- Public comments are not GitHub-dependent. Consider enabling Supabase CAPTCHA / rate limits and moderation for spam control.
- GitHub Pages remains the host; Supabase is the external authentication/database service.

## What can be edited in admin

The visual editor supports design preset, hero layout, colors, title, subtitle, intro text, and a public hero image URL. Its preview updates as you edit. The page editor supports navigation labels, about copy, and footer text. The photo journal manager uploads images (up to 10 MB), captions, and dates to Supabase Storage and publishes them immediately; admins can remove published posts. Save draft stores a browser-local draft; Publish changes the shared page content. Songs and page notes are shared with visitors. Guestbook comments are separate, moderated records; approving a comment makes it public. The backup contains shared page content and collections plus local fallback notes; it excludes visitor submissions.

For the hero image, use a public HTTPS image URL. Photo journal posts are uploaded to the `archive-photos` Supabase Storage bucket and delivered using public image URLs. Previously saved gallery URLs are migrated into the journal when the page content is next published.

## Preview locally

Run `python3 -m http.server 8000` and visit `http://localhost:8000`. Use the local server for the same-origin live admin preview. Cloud features require backend configuration and may require the deployed URL to be listed in Supabase Auth settings.

## Deploy with GitHub Pages

Upload the contents of this folder to the repository root, then open **Settings → Pages** and select `main` / `/(root)`. Wait for the published URL. Update the Supabase Auth Site URL and redirect URL to match it.

## Privacy and rights

Use photos, music, and other media only when you have permission to publish them. This is an unofficial personal appreciation page and is not affiliated with or endorsed by the person featured.

