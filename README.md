# AA Holdings — Interactive Portfolio

A side-scrolling portfolio built with React, Phaser, and Vite. Walk the overworld,
drop into pipes to open project case studies, and enter the castle to read about the studio.

Live at **https://thevisionaryproject.com**

## Local development

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build locally
```

## Editing content

| What                         | Where                                  |
| ---------------------------- | -------------------------------------- |
| Projects (pipes + case pages) | `src/data/projects.js`                 |
| About the studio (castle)     | `src/game/scenes/IdentityScene.js`     |
| Overworld signs, CTA, castle  | `src/game/scenes/OverworldScene.js`    |
| Contact email                 | `src/App.jsx`                          |
| Page title / share preview    | `index.html`                           |

## Deploying to Vercel with thevisionaryproject.com

1. Push this folder to a GitHub repo (or run `npx vercel` from this folder).
2. In Vercel, **Add New → Project**, import the repo. Vercel detects Vite automatically
   (build command `npm run build`, output directory `dist`).
3. Open the project's **Settings → Domains**, add `thevisionaryproject.com`, and also add
   `www.thevisionaryproject.com` set to redirect to the apex domain.
4. At your domain registrar, add the DNS records Vercel shows. Typically:

   | Type  | Name | Value                  |
   | ----- | ---- | ---------------------- |
   | A     | @    | `76.76.21.21`          |
   | CNAME | www  | `cname.vercel-dns.com` |

   Use the exact values Vercel displays if they differ. HTTPS is issued automatically
   once DNS propagates (usually minutes, up to 48 hours).
