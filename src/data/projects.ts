import type { Project } from '../types/project';

export const PROJECTS: Project[] = [
  {
    id: '4',
    title: 'Stockseyes Market Data API',
    subtitle: 'Developer-First Real-Time & Historical Market Data',
    description: 'We shaped Stockseyes as a developer-friendly market-data API, with a product experience that brings real-time quotes, historical queries, API access controls, and a scalable ingestion architecture into one clear vision. The live site is an illustrative demo; production data services are still to be connected.',
    role: 'Product Concept & Platform Architecture',
    yearRange: '2026',
    techStack: ['Market Data API', 'REST', 'Kafka', 'Redis'],
    links: { live: 'https://stockseyes-light.vercel.app/' },
    featured: true
  },
  {
    id: '1',
    title: 'Cross-Platform Mobile Engine',
    subtitle: 'High-Scale Mobile & Web Architecture',
    description: 'We designed and shipped a low-latency cross-platform engine focused on offline-first state synchronization and modular UI components.',
    role: 'Design & Engineering Partner',
    yearRange: '2025 - 2026',
    techStack: ['React Native', 'TypeScript', 'Node.js', 'PostgreSQL'],
    links: { live: 'https://example.com' },
    featured: true
  },
  {
    id: '2',
    title: 'Enterprise Analytics Dashboard',
    subtitle: 'Real-Time Data Pipelines & Visualization',
    description: 'We built custom data pipelines and clean, pragmatic dashboards to streamline performance telemetry and business reporting.',
    role: 'Full Stack Delivery Team',
    yearRange: '2025',
    techStack: ['Astro', 'Tailwind CSS', 'TypeScript'],
    links: { live: 'https://example.com' },
    featured: true
  },
  {
    id: '3',
    title: 'High-Throughput Microservice Framework',
    subtitle: 'Distributed Systems & API Gateway',
    description: 'We engineered lightweight API gateways to handle concurrent client sessions with sub-50ms latency.',
    role: 'Backend Architecture Team',
    yearRange: '2024 - 2025',
    techStack: ['Go', 'Docker', 'Redis', 'gRPC'],
    links: { caseStudy: '/work' },
    featured: false
  }
];