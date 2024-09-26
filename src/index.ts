import Server, { initRoutes } from './Server'
import Path from 'path'

initRoutes(Path.join(process.cwd(), 'src', 'api'))
