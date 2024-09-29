import { Router } from 'express'
import { db } from '../../db/DB'
import { sql } from 'drizzle-orm'
import { jwtAuth } from '../../Server'

const router = Router()
router.use(jwtAuth)

router.get('/status', async (req, res) => {
	return res.json({
		status: 'success',
		db: (await db.execute(sql`SELECT version() as version;`))[0].version,
	})
})

// May be used for some debugging purposes
router.get('/debug', async (req, res) => {
	return res.sendStatus(201)
})

export default router
