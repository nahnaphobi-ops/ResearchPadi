export type Testimonial = {
  name: string;
  institution: string;
  role: string;
  text: string;
  initials: string;
};

/**
 * Real student testimonials for the landing page.
 * Leave empty to hide the section. Add verified quotes only — no invented copy.
 *
 * Example:
 * {
 *   name: 'Akosua M.',
 *   institution: 'KNUST, Kumasi',
 *   role: 'BSc Computer Science',
 *   text: 'Their exact words here.',
 *   initials: 'AM',
 * }
 */
export const testimonials: Testimonial[] = [];
