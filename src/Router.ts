import FS from 'fs'
import Path from 'path'
import Express, { Router } from 'express'
import cookieParser from 'cookie-parser'
import * as Env from '@env'
import Chalk, { ChalkInstance } from 'chalk'

import Logger from '@log'
import { ZodError, ZodSchema } from 'zod'

const handler = Express()
handler.use(cookieParser(Env.SPARKUI_CORE_COOKIE_SECRET))
handler.use(Express.json())

const methodColors: { [key: string]: ChalkInstance } = {
	GET: Chalk.magenta,
	POST: Chalk.green,
	PUT: Chalk.yellow,
	DELETE: Chalk.red,
	PATCH: Chalk.yellowBright,
	OPTIONS: Chalk.blue,
	HEAD: Chalk.blueBright,
}

const routeLogger: Express.RequestHandler = async (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
	const color = methodColors[req.method] || Chalk.white
	Logger.debug(`${color(req.method)}${' '.repeat(7 - req.method.length)} ${req.url}`)
	next()
}

if (Env.SPARKUI_CORE_DEBUG) handler.use(routeLogger)

export async function initRoutes(dir: string, prefix: string) {
	async function initSubRoutes(path: string) {
		for (let f of FS.readdirSync(path)) {
			const item = Path.join(path, f)
			if (FS.lstatSync(item).isDirectory()) {
				await initSubRoutes(Path.join(path, f))
				continue
			}

			if (Path.basename(item) !== 'index.ts') continue

			const routerPrefix = Path.join(prefix, Path.relative(dir, path)).replaceAll('\\', '/')
			Logger.debug('Loading route', routerPrefix)
			const data = await import(item)
			if (data.default instanceof Router) {
				data.default.register()
			} else {
				handler.use(routerPrefix, (await import(item)).default as Express.Router)
			}
		}
	}

	await initSubRoutes(dir)
}

export function valiadteSchema(params: ZodSchema<any>, body: ZodSchema<any>) {
	return async (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
		try {
			req.body = body.parse(req.body)
			req.params = params.parse({ ...req.params, ...req.query })
			next()
		} catch (e) {
			if (e instanceof ZodError) {
				res.status(400).json({ error: e.errors })
				return
			}
			res.status(500).json({ error: 'Internal server error' })
		}
	}
}
export function validateBodySchema(schema: ZodSchema<any>) {
	return async (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
		try {
			req.body = schema.parse(req.body)
			next()
		} catch (e) {
			if (e instanceof ZodError) {
				res.status(400).json({ error: e.errors })
				return
			}
			res.status(500).json({ error: 'Internal server error' })
		}
	}
}
export function validateQuerySchema(schema: ZodSchema<any>) {
	return async (req: Express.Request, res: Express.Response, next: Express.NextFunction) => {
		try {
			req.query = schema.parse({ ...req.params, ...req.query })
			next()
		} catch (e) {
			if (e instanceof ZodError) {
				res.status(400).json({ error: e.errors })
				return
			}
			res.status(500).json({ error: 'Internal server error' })
		}
	}
}

export const server = handler.listen(Env.SPARKUI_CORE_PORT, () => {
	Logger.info(`Server listening on port ${Env.SPARKUI_CORE_PORT}`)
})
