import { drizzle } from 'drizzle-orm/postgres-js'

import * as Env from '@env'
import * as schema from '@db/schema'

const db = drizzle(Env.SPARKUI_CORE_DB_URL, { schema })
export default db
