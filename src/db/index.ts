import { drizzle } from 'drizzle-orm/postgres-js'

import * as Env from '@env'

const db = drizzle(Env.SPARKUI_CORE_DB_URL)
export default db
