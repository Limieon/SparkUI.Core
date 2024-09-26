import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from './Schema'

import { SPARKUI_CORE_DB_URL } from '../Env'

// for query purposes
const queryClient = postgres(SPARKUI_CORE_DB_URL)
export const db = drizzle(queryClient, { schema })
