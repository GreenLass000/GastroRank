export default {
  schema: './server/db/schema.js',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://gastrorank:gastrorank@localhost:5432/gastrorank',
  },
}
