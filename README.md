# 🍋 Lemon

A private ebook reader for two, made for reading together from far away.

- Upload an EPUB once and it appears on both phones
- See where your partner is in the book, and jump to their page
- Highlights, notes, emoji reactions, and replies, with spoilers hidden until you reach them
- **Live reading:** see when your partner is reading the same book, and "follow" their page turns (great on a call)
- Nudges: "Read with me? 🍋", "Goodnight read? 🌙", "Thinking of you 💛" as phone notifications
- A shared reading streak: a lemon tree that grows every day you both read a few pages
- Continue reading from the shelf; new books open at chapter one
- Bookmarks, and an "Our book" keepsake page with your favorite moments
- Zest and Bloom, your companion bots
- Haptics on page turns, highlights and streak moments (Android; iPhone on iOS 18+)
- Works offline: the shelf, books you've opened, and your place (saved and sent once you're back online)
- Paper / Sepia / Night themes and font size, with your place saved automatically
- Android: Share → Lemon sends a downloaded EPUB straight to your shelf
- **Journals:** a second shelf for papers and articles. Paste a link (a PDF, a journal page, or any web article) or upload a PDF, then read it with the same highlights, notes, reactions and replies as books, and see each other's progress

Built with Next.js, [foliate-js](https://github.com/johnfactotum/foliate-js) (the EPUB engine), and Supabase (login, storage, live sync).

---

## Going live (about 15 minutes, all free)

### 1. Create the database
1. Make a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run each file in `supabase/migrations/`, oldest first: paste the whole file and click **Run**.
3. Open **Project Settings → API Keys** and copy the **Project URL**, the **publishable key**, and the **secret key**.

### 2. Add your keys
Replace the top three lines of `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```
Keep the `VAPID_*` lines; they're the keys for phone notifications. Change `VAPID_SUBJECT` to `mailto:your@email`.

### 3. Create your two accounts
```
npm run setup
```
It asks for both names, emails, and passwords. Only these two accounts can see anything in Lemon.

### 4. Put it online (Vercel)
```
npm i -g vercel
vercel            # log in and follow the prompts
```
Then in the Vercel dashboard → your project → **Settings → Environment Variables**, add every line from `.env.local`, and run `vercel --prod`.

### 5. Install on your phones
- **iPhone:** open the link in **Safari** → **Share** → **Add to Home Screen**. Open Lemon from the home screen, log in, tap your avatar → **Turn on notifications**. (iPhone only allows notifications for apps added to the Home Screen.)
- **Android:** open the link in **Chrome** → menu → **Install app**. Log in and turn on notifications the same way.

---

## Running it on your computer
```
npx supabase start   # local database in Docker (ports 553xx)
npm run setup        # first time only
npm run dev
```

## Good to know
- Offline support runs in the production build only (`npm run build && npm start`, or the deployed app). In `npm run dev` the service worker only handles notifications.
- Books are EPUB only. PDFs go in Journals. Files up to 50 MB (Supabase free plan limit).
- Journal links are fetched by the server. Some publishers block automatic downloads; download the PDF yourself and upload it instead. Web articles are saved as clean text, so they keep working if the site changes.
- DRM-protected books (Kindle, Apple Books, Google Play) can't be opened.
- Your partner's notes stay hidden until you've read up to them. Jumping ahead with the slider doesn't count as reading.
