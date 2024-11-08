import FS from 'fs'
import Path from 'path'
import Express, {
    RequestHandler,
    Router,
    type NextFunction,
    type Request,
    type Response,
} from 'express'
import cookieParser from 'cookie-parser'
import * as Env from '@env'
import Chalk from 'chalk'

import Logger from '@log'

const router = Express()
router.use(cookieParser(Env.SPARKUI_CORE_COOKIE_SECRET))
router.use(Express.json())

const methodColors: { [key: string]: ChalkInstance } = {
    GET: Chalk.magenta,
    POST: Chalk.green,
    PUT: Chalk.yellow,
    DELETE: Chalk.red,
    PATCH: Chalk.yellowBright,
    OPTIONS: Chalk.blue,
    HEAD: Chalk.blueBright,
}

const routeLogger: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const color = methodColors[req.method] || Chalk.white
    Logger.debug(
        `${color(req.method)}${' '.repeat(7 - req.method.length)} ${req.url}`
    )
    next()
}

if (Env.SPARKUI_CORE_DEBUG) router.use(routeLogger)

export async function initRoutes(dir: string, prefix: string) {
    async function initSubRoutes(path: string) {
        for (let f of FS.readdirSync(path)) {
            const item = Path.join(path, f)
            if (FS.lstatSync(item).isDirectory()) {
                await initSubRoutes(Path.join(path, f))
                continue
            }

            const routerPrefix = Path.join(
                prefix,
                Path.relative(dir, path)
            ).replaceAll('\\', '/')
            Logger.debug('Loading route', routerPrefix)
            router.use(routerPrefix, (await import(item)).default as Router)
        }
    }

    await initSubRoutes(dir)
}

const server = router.listen(Env.SPARKUI_CORE_PORT, () => {
    Logger.info(`Server listening on port ${Env.SPARKUI_CORE_PORT}`)
})
