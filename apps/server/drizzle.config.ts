import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/domains/*/repo/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://mealmuse:mealmuse@localhost:5433/mealmuse',
  },
});
