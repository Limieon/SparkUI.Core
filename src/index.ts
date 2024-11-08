import * as Env from '@env'
import { initRoutes } from './Router'
import Path from 'path'

import * as Auth from '$/service/Auth'

initRoutes(Path.join(process.cwd(), './src/routes/api/v1'), '/api/v1')
