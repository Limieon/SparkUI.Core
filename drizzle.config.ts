import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config({})

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/db/schema.ts',
	out: './drizzle',
	dbCredentials: {
		host: process.env.SPARKUI_CORE_DB_HOST!,
		port: Number(process.env.SPARKUI_CORE_DB_PORT!),
		user: process.env.SPARKUI_CORE_DB_USER!,
		password: process.env.SPARKUI_CORE_DB_PASS!,
		database: process.env.SPARKUI_CORE_DB_NAME!,
		ssl: process.env.SPARKUI_CORE_DB_SSL === 'true',
	},
})
