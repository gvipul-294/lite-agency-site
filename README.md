## Deployed at https://lite-agency-site.vercel.app/

### Navigate to the project directory
```cd lite-agency-site```

### Install dependencies
```npm install```

### Start the local dev server at http://localhost:4321
```npm run dev```

---

## Directory Hierarchy

```text
src/
├── components/   # Astro UI components (Hero, ProjectCard, PostCard, CalBooking)
├── content/
│   ├── config.ts # Blog collection schema (frontmatter validation)
│   └── blog/     # Blog posts as Markdown — one file per post
├── data/         # Content dataset (projects.ts)
├── pages/        # index.astro, work.astro, contact.astro
│   └── blog/     # index.astro (listing) + [...slug].astro (post template)
├── styles/       # Tailwind baseline + .article long-form styles (global.css)
└── types/        # Domain type definitions (project.ts)
```

---

## Managing Portfolio Content

Update projects directly in `src/data/projects.ts` without modifying UI layout code or backend databases.

```typescript
{
  id: '3',
  title: 'Project Title',
  subtitle: 'High-Level Category / Subtitle',
  description: 'Pragmatic summary of software architecture and features, written in the "we" voice.',
  role: 'Design & Engineering Partner', // Our scope on the engagement, not an individual job title
  yearRange: '2026',
  techStack: ['Astro', 'TypeScript', 'Tailwind CSS'],
  links: { live: 'https://example.com' },
  featured: true // Controls display on the Home page grid
}
```

Update ```contact.astro``` for form and calendar link.

---

## Publishing a Blog Post

Drop a Markdown file into `src/content/blog/`. The filename becomes the URL slug —
`src/content/blog/my-post.md` is served at `/blog/my-post`. No routing or index
updates required; the listing page, the home-page teaser, and the post page all
pick it up automatically.

Every post needs this frontmatter block. The schema in `src/content/config.ts`
validates it at build time, so a typo fails the build instead of shipping broken:

```yaml
---
title: 'Post Title'
description: 'One or two sentences. Used on the cards, the <meta> description, and Open Graph tags.'
pubDate: 2026-08-07          # Sorts the listing, newest first
tags: ['Astro', 'TypeScript']# Optional — rendered as chips
readingTime: '7 min read'    # Optional
draft: false                 # true hides the post from all listings and routes
---
```

Start the body at an `##` heading — do not repeat the title as an `#` heading,
since the template already renders it from `title`. Each `##` section is
automatically added to the "On this page" sidebar.

Long-form Markdown styling (headings, lists, code blocks, tables, blockquotes)
lives under the `.article` class in `src/styles/global.css`.

---

## Building & Local Testing

```bash
# Compile static bundle to dist/
npm run build

# Preview static production files locally
npm run preview
```
