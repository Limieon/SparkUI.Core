import { authMiddleware } from '$/service/Auth'
import Router from '$/Router'

import { UserSchema } from '$/routes/api/v1/user'

import * as Table from '@db/schema'

import z, { ZodError } from 'zod'
import db from '$/db'
import { and, eq } from 'drizzle-orm'
import Logger from '@log'

//const router = Router()
//router.use(authMiddleware)

export const ImageSchema = z.object({
	id: z.string().uuid(),
	blurHash: z.string(),
	createdAt: z.number(),
})
export const RefImageSceham = z.object({
	id: z.string().uuid(),
})
export type ImageType = z.infer<typeof ImageSchema>
export type RefImageType = z.infer<typeof RefImageSceham>

const router = new Router('/api/v1/image')
router.get('/', z.object({}), async (req) => {
	const user = req.user
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

	return {
		status: 200,
		body: { data, meta: {} },
	}
})

router.get(
	'/:id/raw.webp',
	z.object({
		id: z.string().uuid(),
	}),
	async (req) => {
		const image = await db
			.select({ data: Table.Image.data })
			.from(Table.Image)
			.where(and(eq(Table.Image.id, req.query.id), eq(Table.Image.creatorId, req.user.sub)))
			.limit(1)

		if (image.length < 1)
			return {
				status: 404,
				body: { error: 'Image not found' },
			}

		return {
			status: 200,
			contentType: 'image/webp',
			body: image[0].data,
		}
	}
)

export default router
