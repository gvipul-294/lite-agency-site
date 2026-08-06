export interface Project {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  role: string;
  yearRange: string;
  techStack: string[];
  links: {
    live?: string;
    caseStudy?: string;
    repo?: string;
  };
  featured: boolean;
}