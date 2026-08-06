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
├── components/   # Astro UI components (Hero, ProjectCard, CalBooking)
├── data/         # Content dataset (projects.ts)
├── pages/        # Static pages (index.astro, work.astro, contact.astro)
├── styles/       # Tailwind baseline styles (global.css)
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
  description: 'Pragmatic summary of software architecture and features.',
  role: 'Full Stack Engineer',
  yearRange: '2026',
  techStack: ['Astro', 'TypeScript', 'Tailwind CSS'],
  links: { live: 'https://example.com' },
  featured: true // Controls display on the Home page grid
}
```

Update ```contact.astro``` for form and calendar link.

---

## Building & Local Testing

```bash
# Compile static bundle to dist/
npm run build

# Preview static production files locally
npm run preview
```
