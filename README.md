# Biggest Fan Archive

A personal appreciation website for רואי, built with plain HTML/CSS/JavaScript and hosted on GitHub Pages. Shared content, protected administration, and shared visitor comments use Supabase (hosted Postgres + Auth). GitHub login is not required for visitors.

## Files

- `index.html`, `styles.css`, `public-app.js` — public site and shared content integration
- `admin.html`, `admin.css`, `admin-app.js` — authenticated content management, editing, backup, and moderation
- `backend-config.js` — **public** Supabase project URL and anon key (safe to publish when Row Level Security is enabled)
- `supabase-schema.sql` — database tables, grants, and Row Level Security policies
- `archive-data.json` and `assets/archive/` — shared archive content and media published to the GitHub repository
- Supabase Storage buckets `archive-photos` and `archive-audio` — legacy media storage for previously uploaded files
- `assets/` — optional locally hosted site assets

## One-time backend setup

GitHub Pages cannot run a private server or protect an admin page on its own. This project uses Supabase Auth and Postgres. The HTML/JS files are public, but the database policies enforce which operations visitors and authenticated users can perform.

1. Create a project at [Supabase](https://supabase.com/) and wait for its database to finish provisioning.
2. In the Supabase dashboard, open **SQL Editor**, paste all of `supabase-schema.sql`, and run it. This creates the database policies and legacy media buckets. New archive media is stored in the GitHub repository after you connect GitHub in admin.
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
8. Open `/admin.html`, connect GitHub from the sign-in screen, and sign in using the admin user you created. Complete the one-time copy described below; until then, the page uses Supabase as its legacy content source.

## Move archive content to GitHub

The site can store page content in `archive-data.json` and uploaded media in `assets/archive/` in this repository. This stops the public page from reading songs, photos, page copy, and visual settings from Supabase on every visit. Supabase remains in use for admin sign-in and visitor guestbook submissions/moderation.

1. Create a **fine-grained personal access token** for this repository only, with **Contents: Read and write** permission and an expiry date. Do not use a classic token or put a token in any website file.
2. Open `admin.html`. On the sign-in screen, fill in the owner, repository, branch, and token, then click **Connect GitHub**. The token is held in memory for this browser session and is not stored in local storage or committed.
3. Sign in to admin, then click **Copy existing archive to GitHub** once. It imports the current Supabase content to `archive-data.json` and attempts to copy existing photos/audio it can read into the repository. Links stay as links. Media sources that block browser downloads or exceed 25 MB remain linked to their current public URL.
4. After `archive-data.json` is published, the public page reads it from GitHub Pages. Future edits to songs, notes, photos, noises, and page settings write to GitHub. Removing a song or note removes its entry from the JSON; removing an uploaded photo/audio file also deletes that asset from the repository.
5. Connect GitHub again after each admin page reload; the token is deliberately not remembered. The repo name and branch can be remembered safely.

GitHub Pages takes a short time to publish commits. After editing content, the admin preview updates immediately; visitors may need a brief moment before the committed JSON and media become available.

### Security notes

- Never commit a Supabase `service_role` key, database password, or other secret to this repository.
- The anon/publishable key is expected to be visible in the browser. **RLS policies are the security boundary.** Review policies if you customize the database.
- Supabase Auth only grants access to authenticated users. Disable public account creation and create only trusted admin users. For a higher-security multi-admin deployment, add an explicit admin-role table/policy rather than allowing every authenticated user to moderate content.
- Visitor comments are stored as pending (`approved=false`). Only approved comments are shown publicly. An authenticated admin can approve or delete comments in the admin page.
- Public comments are not GitHub-dependent. Consider enabling Supabase CAPTCHA / rate limits and moderation for spam control.
- GitHub Pages remains the host; Supabase is the external authentication/database service.

## What can be edited in admin

The visual editor keeps the public page black and white while letting you change its shared accent, title, subtitle, intro text, and public hero image. Its preview updates as you edit. The page editor supports navigation labels, about copy, and footer text. Once GitHub is connected, photo journal and Noises uploads commit media and their captions/dates to the repository. Songs and page notes are shared in `archive-data.json`. Guestbook comments remain separate Supabase records; approving a comment makes it public. The backup contains shared page content and collections, and excludes visitor submissions.

For the hero image, upload a picture from Photos/Files in the admin or use a public HTTPS image URL. New hero images, journal photos, and Noises recordings are committed to `assets/archive/` in GitHub. Previously saved public URLs are copied into the repository when the browser can access them; otherwise their current URLs remain in use.

## Preview locally

Run `python3 -m http.server 8000` and visit `http://localhost:8000`. Use the local server for the same-origin live admin preview. Cloud features require backend configuration and may require the deployed URL to be listed in Supabase Auth settings.

## Deploy with GitHub Pages

Upload the contents of this folder to the repository root, then open **Settings → Pages** and select `main` / `/(root)`. Wait for the published URL. Update the Supabase Auth Site URL and redirect URL to match it.

## Privacy and rights

Use photos, music, and other media only when you have permission to publish them. This is an unofficial personal appreciation page and is not affiliated with or endorsed by the person featured.
