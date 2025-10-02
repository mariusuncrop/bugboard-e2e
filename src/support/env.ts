import 'dotenv/config';

const required = (name: string, fallback: string): string => process.env[name] ?? fallback;

export const env = {
  baseUrl: required('BASE_URL', 'http://localhost:5173'),
  apiUrl: required('API_URL', 'http://localhost:4000'),
  admin: {
    email: required('ADMIN_EMAIL', 'admin@bugboard.dev'),
    password: required('ADMIN_PASSWORD', 'Password123!'),
  },
  member: {
    email: required('MEMBER_EMAIL', 'dev@bugboard.dev'),
    password: required('MEMBER_PASSWORD', 'Password123!'),
  },
};

/**
 * Seeded projects, chosen for what they prove:
 *   WEB  every demo user is a member — the default for specs that do not care
 *   API  Jonas (pm) is not a member
 *   MOB  Marco (dev) and Priya (qa) are not members
 */
export const PROJECTS = {
  main: 'WEB',
  withoutPm: 'API',
  withoutMember: 'MOB',
} as const;

export const STORAGE_STATE = {
  admin: '.auth/admin.json',
  member: '.auth/member.json',
} as const;
