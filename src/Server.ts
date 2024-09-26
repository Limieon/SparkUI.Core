import Express, { Router, type NextFunction, type Request, type Response } from 'express'
import { logger } from './Utils.ts'
import { SPARKUI_CORE_DB_HOST, SPARKUI_CORE_DEBUG, SPARKUI_CORE_JWT_SECRET, SPARKUI_CORE_PORT } from './Env.ts'
import FS from 'fs'
import Path from 'path'

import JWT from 'jsonwebtoken'

const app = Express()
app.use(Express.json())

const devUser = {
	id: '00000000-0000-0000-0000-000000000000',
	name: 'dev',
	email: 'dev@dev.dev',
}

export function jwtAuth(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.headers['authorization']
	const token = authHeader && authHeader.split(' ')[1]

	if (!token) {
		if (SPARKUI_CORE_DEBUG) {
			req.user = devUser
			return next()
		}
		return res.status(401).json({ message: 'Access denied, no token provided' })
	}
	JWT.verify(token, SPARKUI_CORE_JWT_SECRET, (err, user) => {
		if (err) return res.status(403).json({ message: 'Access denied, invalid token' })
		req.user = user

		next()
	})
}

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
