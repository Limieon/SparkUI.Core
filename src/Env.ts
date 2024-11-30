import Path from 'path'

export const {
	SPARKUI_CORE_HOST = '127.0.0.1',
	SPARKUI_CORE_DB_HOST = 'db',
	SPARKUI_CORE_DB_NAME = 'sparkui.core',
	SPARKUI_CORE_DB_USER = 'sparkui.core',
	SPARKUI_CORE_DB_PASSWORD = 'sparkui.core',
	SPARKUI_CORE_CIVITAI_KEY = 'civitai',
	SPARKUI_CORE_JWT_SECRET = 'secret',
	SPARKUI_CORE_JWT_EXPIRES = '15m',
	SPARKUI_CORE_JWT_REFRESH_SECRET = 'refresh',
	SPARKUI_CORE_JWT_REFRESH_EXPIRES = '7d',
	SPARKUI_CORE_JWT_COOKIE = 'sparkui_core_access',
	SPARKUI_CORE_JWT_REFRESH_COOKIE = 'sparkui_core_refresh',
	SPARKUI_CORE_COOKIE_SECRET = 'secret',
} = process.env

export const SPARKUI_CORE_PORT = Number.parseInt(process.env.SPARKUI_CORE_PORT || '1911')
export const SPARKUI_CORE_DB_PORT = Number.parseInt(process.env.SPARKUI_CORE_DB_PORT || '5432')
export const SPARKUI_CORE_DB_SSL = process.env.SPARKUI_CORE_DB_SSL?.toLowerCase() == 'true'

export const SPARKUI_CORE_DB_URL = `postgresql://${SPARKUI_CORE_DB_USER}:${SPARKUI_CORE_DB_PASSWORD}@${SPARKUI_CORE_DB_HOST}:${SPARKUI_CORE_DB_PORT}/${SPARKUI_CORE_DB_NAME}?sslmode=${SPARKUI_CORE_DB_SSL}`

export const SPARKUI_CORE_DEBUG = process.env.SPARKUI_CORE_DEBUG?.toLowerCase() == 'true'

export const SPARKUI_CORE_DATA_DIR = Path.resolve(process.env.SPARKUI_CORE_DATA_DIR || 'data')
