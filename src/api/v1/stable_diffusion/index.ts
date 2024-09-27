import { Router } from 'express'
import { db } from '../../../db/DB'
import { logger } from '../../../Utils'
import { eq, or } from 'drizzle-orm'
import { SPARKUI_CORE_BASE_URL, SPARKUI_CORE_DEBUG } from '../../../Env'
import { type JWTPayload } from '../user/index.ts'
import * as BlurHash from 'blurhash'

import Sharp from 'sharp'
import Multer from 'multer'
import FS from 'fs'

import { jwtAuth } from '../../../Server'
import { Image, SDBaseItem, SDCheckpointItem, SDContainer } from '../../../db/Schema'
import { appendImageURL } from '../image/index.ts'

const imageUpload = Multer({
	storage: Multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1048576,
	},
})

const router = Router()
router.use(jwtAuth)

interface SPostContainer {
	name: string
	brief: string
	description?: string
}

interface SPostBaseData {
	name: string
	brief: string
	description?: string
	version?: string
	nsfw?: boolean
	nsfwLevel?: number
}
interface SPostCheckpoint extends SPostBaseData {
	refiner?: boolean
}

router.post('/container', async (req, res) => {
	const data: SPostContainer = req.body
	const jwt: JWTPayload = req.user

	if (!data.name || !data.brief) {
		return res.status(400).json({ message: 'Bad Request' })
	}

	const dbContainer = await db
		.insert(SDContainer)
		.values({ ...data, creatorId: jwt.id })
		.returning()
	return res.json({ data: dbContainer[0] })
})

router.put('/container/:containerId/checkpoint', async (req, res) => {
	const data: SPostCheckpoint = req.body
	const jwt: JWTPayload = req.user
	if (!data.name || !data.brief) return res.status(400).json({ message: 'Bad Request' })

	const containerId = req.params.containerId
	const dbContainer = await db.select().from(SDContainer).where(eq(SDContainer.id, containerId))
	if (dbContainer.length < 1) return res.status(404).json({ message: 'Container Not Found' })

	const dbBaseItem = await db
		.insert(SDBaseItem)
		.values({
			name: data.name,
			type: 'Checkpoint',
			brief: data.brief,
			description: data.description || '',
			version: data.version || '',
			nsfw: data.nsfw || false,
			nsfwLevel: data.nsfwLevel || 0,
			containerId: containerId,
			creatorId: jwt.id,
		})
		.returning()
	const dbCheckpoint = await db
		.insert(SDCheckpointItem)
		.values({
			id: dbBaseItem[0].id,
			refiner: data.refiner ? true : false,
		})
		.returning()

	return res.json({ data: { ...dbBaseItem[0], ...dbCheckpoint[0] } })
})

router.put('/container/:itemId/image', imageUpload.single('image'), async (req, res) => {
	const jwt: JWTPayload = req.user
	const itemId = req.params.itemId as string

	if (!req.file) return res.status(400).json({ message: 'Bad Request' })

	try {
		const item = await db.select().from(SDBaseItem).where(eq(SDBaseItem.id, itemId))
		if (item.length < 1) return res.status(404).json({ message: 'Item Not Found' })

		const sharpInstance = Sharp(req.file.buffer).ensureAlpha()

		const [webp, rawImage] = await Promise.all([
			sharpInstance.clone().webp().toBuffer(),
			sharpInstance.raw().toBuffer({ resolveWithObject: true }),
		])

		await db.insert(Image).values({
			creatorId: jwt.id,
			data: webp,
			baseItemId: itemId,
			blurHash: BlurHash.encode(new Uint8ClampedArray(rawImage.data), rawImage.info.width, rawImage.info.height, 4, 8),
		})

		return res.json({ message: 'Image uploaded successfully!' })
	} catch (error) {
		logger.error(error)
		return res.status(500).json({ message: 'Internal Server Error' })
	}
})

router.get('/container/:containerId', async (req, res) => {
	const containerId = req.params.containerId
	const jwt = req.user

	if (!containerId) return res.status(400).json({ message: 'Bad Request' })

	const data = await db.query.SDContainer.findFirst({
		where: (i, { eq }) => eq(i.id, containerId),
		with: {
			items: {
				with: {
					creator: {
						columns: {
							id: true,
							username: true,
						},
					},
					previewImages: {
						columns: {
							id: true,
							blurHash: true,
						},
						with: {
							generationBatchItem: {
								columns: {
									id: true,
									batchId: true,
								},
							},
						},
					},
				},
			},
		},
	})

	if (!data) return res.status(404).json({ message: 'Container Not Found' })
	for (let item of data.items) {
		for (let img of item.previewImages) img = appendImageURL(img)
	}

	return res.json({ data })
})

router.get('/item/:itemId', async (req, res) => {
	const itemId = req.params.itemId
	const jwt = req.user

	if (!itemId) return res.status(400).json({ message: 'Bad Request' })

	const data = await db.query.SDBaseItem.findFirst({
		where: (i, { eq }) => eq(i.id, itemId),
		with: {
			creator: {
				columns: {
					id: true,
					username: true,
				},
			},
			previewImages: {
				columns: {
					id: true,
					blurHash: true,
				},
			},
		},
	})

	if (!data) return res.status(404).json({ message: 'Item Not Found' })
	for (let img of data.previewImages) img = appendImageURL(img)

	return res.json({ data })
})

export default router
