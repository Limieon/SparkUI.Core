import FS from 'fs'
import Path from 'path'
import * as Express from 'express'
import cookieParser from 'cookie-parser'
import * as Env from '@env'
import Chalk, { ChalkInstance } from 'chalk'

import Logger from '@log'
import { ZodError, ZodSchema } from 'zod'
import { authMiddleware, JWTPayload } from './service/Auth'

const handler = Express.default()
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

const server = handler.listen(Env.SPARKUI_CORE_PORT, () => {
	Logger.info(`Server listening on port ${Env.SPARKUI_CORE_PORT}`)
})

interface RequestHandlerParams<Q> {
	handle: Express.Request
	query: Q
}
interface AuthRequestHandlerParams<Q> {
	handle: Express.Request
	query: Q
	user: JWTPayload
}

interface BodyRequestHandlerParams<Q, B> extends RequestHandlerParams<Q> {
	body: B
}
interface BodyAuthRequestHandlerParams<Q, B> extends AuthRequestHandlerParams<Q> {
	body: B
}

interface RequestHandlerReturn {
	headers?: { [key: string]: string }
	cookies?: { [key: string]: string }
	contentType?: string
	body?: any
	status: number
}

type RequestHandler<Q> = (req: RequestHandlerParams<Q>) => Promise<RequestHandlerReturn>
type AuthRequestHandler<Q> = (req: AuthRequestHandlerParams<Q>) => Promise<RequestHandlerReturn>

type BodyRequestHandler<Q, B> = (req: BodyRequestHandlerParams<Q, B>) => Promise<RequestHandlerReturn>
type BodyAuthRequestHandler<Q, B> = (req: BodyAuthRequestHandlerParams<Q, B>) => Promise<RequestHandlerReturn>

export default class Router {
	constructor(prefix: string, secure: boolean = true) {
		this.prefix = prefix
		this.router = Express.Router()
		this.router.use(authMiddleware)
	}

	private async getRequestData<Q>(req: Express.Request, schema: ZodSchema<Q>, handler: RequestHandler<Q>) {
		const query = schema.parse({ ...req.query, ...req.params })
		const response = await handler({ handle: req, query })
		return {
			response,
			contentType: this.getContentType(response),
		}
	}
	private async getRequestDataSecure<Q>(req: Express.Request, schema: ZodSchema<Q>, handler: AuthRequestHandler<Q>) {
		const query = schema.parse({ ...req.query, ...req.params })
		const response = await handler({ handle: req, query, user: req.user! })
		return {
			response,
			user: req.user,
			contentType: this.getContentType(response),
		}
	}

	private async getRequestDataWithBody<Q, B>(
		req: Express.Request,
		querySchema: ZodSchema<Q>,
		bodySchema: ZodSchema<B>,
		handler: BodyRequestHandler<Q, B>
	) {
		const query = querySchema.parse({ ...req.query, ...req.params })
		const body = bodySchema.parse(req.body)
		const response = await handler({ handle: req, query, body })
		return {
			response,
			contentType: this.getContentType(response),
			body,
		}
	}
	private async getRequestDataWithBodySecure<Q, B>(
		req: Express.Request,
		querySchema: ZodSchema<Q>,
		bodySchema: ZodSchema<B>,
		handler: BodyAuthRequestHandler<Q, B>
	) {
		const query = querySchema.parse({ ...req.query, ...req.params })
		const body = bodySchema.parse(req.body)
		const response = await handler({ handle: req, query, user: req.user!, body })
		return {
			response,
			contentType: this.getContentType(response),
			body,
		}
	}

	private returnError(res: Express.Response, e: any) {
		if (e instanceof ZodError) {
			res.status(400).json({ error: e.message, success: false })
		} else {
			Logger.error(e)

			if (Env.SPARKUI_CORE_DEBUG) {
				res.status(500).json({ error: e.message, stack: e.stack })
			} else {
				res.status(500).json({ error: 'Internal server error' })
			}
		}
	}
	private parseResponse(contentType: string, res: Express.Response, response: RequestHandlerReturn) {
		res.status(response.status)

		if (response.headers) {
			for (let key in response.headers) {
				res.header(key, response.headers[key])
			}
		}
		res.contentType(contentType)

		if (response.cookies) {
			for (let key in response.cookies) {
				res.cookie(key, response.cookies[key])
			}
		}

		res.send(response.body)
	}
	private getContentType(response: RequestHandlerReturn) {
		return response.contentType
			? response.contentType
			: response.body instanceof Buffer
			? 'application/octet-stream'
			: response.body instanceof Object
			? 'application/json'
			: 'text/plain'
	}

	get<Q = {}>(path: string, querySchema: ZodSchema<Q>, handler: AuthRequestHandler<Q>) {
		Logger.debug('Registering GET', path)
		this.router.get(path, async (req, res) => {
			try {
				const user = req.user
				if (!user) {
					res.status(401).json({ error: 'Unauthorized' })
					return
				}

				const { response, contentType } = await this.getRequestDataSecure(req, querySchema, handler)
				this.parseResponse(contentType, res, response)
			} catch (e) {
				this.returnError(res, e)
			}
		})
	}

	post<Q = {}, B = {}>(path: string, querySchema: ZodSchema<Q>, bodySchema: ZodSchema<B>, handler: BodyAuthRequestHandler<Q, B>) {
		Logger.debug('Registering POST', path)

		this.router.post(path, async (req, res) => {
			try {
				const user = req.user
				if (!user) {
					res.status(401).json({ error: 'Unauthorized' })
					return
				}

				const { response, contentType } = await this.getRequestDataWithBodySecure(req, querySchema, bodySchema, handler)
				this.parseResponse(contentType, res, response)
			} catch (e) {
				this.returnError(res, e)
			}
		})
	}

	register() {
		Logger.debug('Registering router', this.prefix)
		handler.use(this.prefix, this.router)
	}

	use(path: string, handler: Express.RequestHandler) {
		this.router.use(Path.join(this.prefix, path).replaceAll('\\\\', '/'), handler)
	}

	prefix: string
	router: Express.Router
}
