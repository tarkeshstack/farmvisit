# Farm Visit on Google Sheets — setup (about 10 minutes, once)

You get three web apps that all read and write the same Google Sheet:

| File | Who uses it | What it does |
|---|---|---|
| `admin.html` | Owner, admins | Metrics, custom fields, farms, team, all visits, exports |
| `index.html` | Auditors | The farm visit form (works offline, syncs when online) |
| `reports.html` | Viewers, admins, auditors | Read-only reports and dashboards |

## Just want to look around first?
Open any of the three pages. With no sheet connected you get **Skip and explore**: it loads sample data (6 farms, 27 visits, a small team) that lives only in your browser, and signs you in as a fitting demo person (owner in Admin, auditor in the Visit form, viewer in Reports). All three pages on the same site share that demo, so a visit saved in the form shows up in Admin and Reports. "Start the demo over" is on the sign-in screen. Host the three files together (or open them from one folder on a local web server), because the demo is built by the Visit form and Admin page working together.

## Connecting the real sheet later
Do steps 1 and 2 below. Then either press **Connect my Google Sheet instead** on the first screen, or, to remove that step for everyone, open each HTML file in a text editor, find `window.FV_API_URL = "";` near the top and paste your `/exec` address between the quotes. People then only see sign-in.

## 1. Create the sheet and the backend
1. Make a new Google Sheet (name it e.g. "Farm Visit data").
2. **Extensions → Apps Script**. Delete the sample code, paste all of `Code.gs`, press **Save**.
3. In the function list pick **setup** and press **Run**. Allow the permissions it asks for. The tabs (Settings, Users, Farms, Visits …) appear in the sheet.
4. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Press Deploy and copy the address that ends in `/exec`.

"Anyone" only means the address can be reached. Nobody can read data without an account you created.

## 2. Put the three pages online
Upload `index.html`, `admin.html`, `reports.html` to the same folder of any static host (GitHub Pages, Netlify, Cloudflare Pages, your own site). Keep the three files side by side; they link to each other.

## 3. First sign-in
Open `admin.html` (connected as above), then create the workspace (you become the owner). In **Organisation** you get two ready links, one for the visit form and one for reports, that already contain the address. Send those to your people. In **Team** add auditors (form) and viewers (reports, all farms or only chosen farms).

Sign-in is shared by the three pages on the same device, so an admin switching between them signs in once.

## Try it with demo data
On the very first screen of `admin.html` (before you create a workspace) press **Or try it with demo data**. It fills the sheet with Demo Poultry Co: 6 farms, 7 people, about 27 visits with signatures, custom fields and metrics. It takes about a minute because every visit is written to the sheet. Use a fresh, empty sheet for this.

| Sign in as | Email | Password |
|---|---|---|
| Owner | owner@demo.test | demo1234 |
| Admin | kavya@demo.test | demo1234 |
| Auditors | asha@, vikram@, priya@demo.test | demo1234 |
| Viewer (reports only) | viewer@demo.test | demo1234 |
| First sign-in flow | newhire@demo.test | Welcome2026 (asks for a new password) |

To start for real, make a new empty sheet (or delete every row below the headers in each tab) and create your own workspace.

## Good to know
- **Changing Code.gs later:** Deploy → Manage deployments → edit → Version: New version. The address stays the same.
- **Speed:** Google Sheets answers in 1 to 3 seconds per call. The visit form saves on the phone first and syncs in the background.
- **Size:** comfortable up to a few thousand visits. Past that, export and archive old years into another sheet.
- **Editing the sheet by hand:** safe for reading, filtering and charting. Do not rename tabs or the header row, and avoid editing Users and Sessions. Use **Organisation → Refresh the "KPI readings" tab** for a tidy table of every metric for pivots.
- **Passwords** are stored salted and hashed in the Users tab, but with a lighter method than a dedicated server. Use strong passwords, and keep the sheet itself shared with as few people as possible, because anyone who can open the sheet can read it.
- **Daily limits:** a free Google account has daily Apps Script quotas (many thousands of calls), enough for a team of dozens of auditors.

## The Android app (visit form)
Auditors can use the visit form as an Android app. The Admin console and Reports stay web pages. All three use the same Google Sheet.
- **Download:** https://github.com/tarkeshstack/farmvisit/releases/latest/download/FarmVisit.apk. Open it on the phone and allow installing from the browser when asked.
- **How it works:** the app opens the visit form from `https://tarkeshstack.github.io/farmvisit/`, so changes to `index.html` show up in the app without reinstalling. Open it once with internet; after that it also opens without signal. Visits are saved on the phone and sync when it is online.
- **PDFs and backups** open the phone's share sheet, so you can save them or send them on WhatsApp, Drive or email.
- **New app builds:** every push to `main` that changes `mobile/` builds a new APK (GitHub → Actions → "Android app"). You can also start one by hand from that page with "Run workflow".
- **Without an app:** in Chrome on the phone, open the visit form and choose "Add to Home screen".
