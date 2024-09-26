import { Router } from 'express'
import { db } from '../../db/DB'
import { sql } from 'drizzle-orm'

const router = Router()

router.get('/status', async (req, res) => {
	return res.json({
		status: 'success',
		db: (await db.execute(sql`SELECT version() as version;`))[0].version,
	})
})

export default router
