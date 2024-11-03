import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: './src/db/schema.ts',

	dbCredentials: {
		host: process.env.SPARKUI_CORE_DB_HOST!,
		port: Number(process.env.SPARKUI_CORE_DB_PORT!),
		user: process.env.SPARKUI_CORE_DB_USER!,
		password: process.env.SPARKUI_CORE_DB_PASSWORD!,
		database: process.env.SPARKUI_CORE_DB_NAME!,
		ssl: process.env.SPARKUI_CORE_DB_SSL === 'true',
	},

	verbose: true,
	strict: true,
	dialect: 'postgresql',
})
