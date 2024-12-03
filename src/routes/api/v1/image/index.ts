import { authMiddleware } from '$/service/Auth'
import { Request, Response, Router } from 'express'

import { UserSchema } from '$/routes/api/v1/user'

import * as Table from '@db/schema'

import z, { ZodError } from 'zod'
import db from '$/db'
import { and, eq } from 'drizzle-orm'
import Logger from '@log'
import { validateQuerySchema } from '$/Router'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
	const user = req.user!
	const images = await db
		.select({
			id: Table.Image.id,
			createdAt: Table.Image.createdAt,
			blurHash: Table.Image.blurHash,
		})
		.from(Table.Image)
		.where(eq(Table.Image.creatorId, user.sub))

	const data = images.map((e) => ({
		id: e.id,
		blurHash: e.blurHash,
		createdAt: e.createdAt,
	}))

	res.status(200).send({ data, meta: {} })
})

router.get('/:id/raw.webp', validateQuerySchema(z.object({ id: z.string().uuid() })), async (req: Request, res: Response) => {
	const user = req.user!
	const image = await db
		.select({ data: Table.Image.data })
		.from(Table.Image)
		.where(and(eq(Table.Image.id, req.query.id), eq(Table.Image.creatorId, user.sub)))
		.limit(1)

	if (image.length < 1) {
		res.status(404).send({ error: 'Image not found' })
		return
	}

	res.setHeader('Content-Type', 'image/webp')
	res.status(200).send(image[0].data)
})

export default router
