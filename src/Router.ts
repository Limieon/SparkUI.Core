import FS from 'fs'
import Path from 'path'
import { Hono } from 'hono'

export async function initRoutes(app: Hono, dir: string, prefix: string) {
    async function initSubRoutes(path: string) {
        for (let f of FS.readdirSync(path)) {
            const item = Path.join(path, f)
            console.log(item)
            if (FS.lstatSync(item).isDirectory()) {
                await initSubRoutes(Path.join(path, f))
                continue
            }

            const routerPrefix = Path.join(
                prefix,
                Path.relative(dir, path)
            ).replace('\\', '/')
            app.route(routerPrefix, (await import(item)).default)
        }
    }

    await initSubRoutes(dir)
}
