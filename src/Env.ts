export const {
	SPARKUI_CORE_HOST = '127.0.0.1',
	SPARKUI_CORE_DB_HOST = 'db',
	SPARKUI_CORE_DB_NAME = 'sparkui',
	SPARKUI_CORE_DB_USER = 'postgres',
	SPARKUI_CORE_DB_PASS = 'adminadmin',
} = process.env

export const SPARKUI_CORE_PORT = Number(process.env.SPARKUI_CORE_PORT ?? '1911')
export const SPARKUI_CORE_DB_PORT = Number(process.env.SPARKUI_CORE_DB_PORT ?? '5432')
export const SPARKUI_CORE_DB_SSL = process.env.SPARKUI_CORE_DB_SSL === 'true'
export const SPARKUI_CORE_DB_URL = `postgres://${SPARKUI_CORE_DB_USER}:${SPARKUI_CORE_DB_PASS}@${SPARKUI_CORE_DB_HOST}:${SPARKUI_CORE_DB_PORT}/${SPARKUI_CORE_DB_NAME}`

export const SPARKUI_CORE_DEBUG = process.env.SPARKUI_CORE_DEBUG === 'true'

process.env.SPARKUI_CORE_DB_URL = SPARKUI_CORE_DB_URL
