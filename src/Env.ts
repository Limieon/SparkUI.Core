export const {
    SPARKUI_CORE_HOST = '127.0.0.1',
    SPARKUI_CORE_DB_HOST = 'db',
    SPARKUI_CORE_DB_NAME = 'sparkui.core',
    SPARKUI_CORE_DB_USER = 'sparkui.core',
    SPARKUI_CORE_DB_PASSWORD = 'sparkui.core',
} = process.env

export const SPARKUI_CORE_PORT = Number.parseInt(
    process.env.SPARKUI_CORE_PORT || '1911'
)
export const SPARKUI_CORE_DB_PORT = Number.parseInt(
    process.env.SPARKUI_CORE_DB_PORT || '5432'
)
export const SPARKUI_CORE_DB_SSL =
    process.env.SPARKUI_CORE_DB_SSL?.toLowerCase() == 'true'

export const SPARKUI_CORE_DB_URL = `postgresql://${SPARKUI_CORE_DB_USER}:${SPARKUI_CORE_DB_PASSWORD}@${SPARKUI_CORE_DB_HOST}:${SPARKUI_CORE_DB_PORT}/${SPARKUI_CORE_DB_NAME}?sslmode=${SPARKUI_CORE_DB_SSL}`
