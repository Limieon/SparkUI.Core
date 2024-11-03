import FS from 'fs'
import Path from 'path'
import Express, { Router, type NextFunction, type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import * as Env from '@env'

const router = Express()
router.use(cookieParser(Env.SPARKUI_CORE_COOKIE_SECRET))
router.use(Express.json())

export async function initRoutes(dir: string, prefix: string) {
	async function initSubRoutes(path: string) {
		for (let f of FS.readdirSync(path)) {
			const item = Path.join(path, f)
			console.log(item)
			if (FS.lstatSync(item).isDirectory()) {
				await initSubRoutes(Path.join(path, f))
				continue
			}

			const routerPrefix = Path.join(prefix, Path.relative(dir, path)).replaceAll('\\', '/')
			console.log(routerPrefix)
			router.use(routerPrefix, (await import(item)).default as Router)
		}
	}

	await initSubRoutes(dir)
}

const server = router.listen(Env.SPARKUI_CORE_PORT, () => {
	console.log(`Server listening on port ${Env.SPARKUI_CORE_PORT}`)
})
