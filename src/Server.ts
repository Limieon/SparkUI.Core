import Express, { Router } from 'express'
import { logger } from './Utils.ts'
import { SPARKUI_CORE_DB_HOST, SPARKUI_CORE_PORT } from './Env.ts'
import FS from 'fs'
import Path from 'path'

const app = Express()
app.use(Express.json())

export function initRoutes(dir: string) {
	for (let f of FS.readdirSync(dir)) {
		const path = Path.join(dir, f)
		if (FS.statSync(path).isDirectory()) {
			return initRoutes(path)
		}

		const router: Router = require(path).default
		const prefix =
			'/' +
			Path.relative(process.cwd() + '/src', path)
				.replaceAll('\\', '/')
				.split('/')
				.slice(0, -1)
				.join('/')
		app.use(prefix, router)
		logger.debug(`Loaded ${router.stack.length} routes from ${prefix}`)
	}
}

export const httpServer = app.listen(1911, () => {
	logger.info(`Server started on ${SPARKUI_CORE_DB_HOST}:${SPARKUI_CORE_PORT}`)
})

export default app
