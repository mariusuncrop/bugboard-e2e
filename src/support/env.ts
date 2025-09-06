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

export const STORAGE_STATE = {
  admin: '.auth/admin.json',
  member: '.auth/member.json',
} as const;
