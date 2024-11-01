import { Hono } from 'hono'
import { Router } from 'hono/router'
import * as Env from '@env'
import { initRoutes } from './Router'
import Path from 'path'

const app = new Hono()
initRoutes(app, Path.join(process.cwd(), './src/routes/api/v1'), '/api/v1')

export default {
    host: Env.SPARKUI_CORE_HOST,
    port: Env.SPARKUI_CORE_PORT,
    fetch: app.fetch,
}
