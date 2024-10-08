import { Router } from 'express'
import { db } from '../../../../db/DB'
import { logger } from '../../../../Utils'
import { eq, or } from 'drizzle-orm'
import { SPARKUI_CORE_BASE_URL, SPARKUI_CORE_CIVITAI_BASE, SPARKUI_CORE_DEBUG } from '../../../../Env'
import { type JWTPayload } from '../../user/index.ts'
import * as BlurHash from 'blurhash'
import Express from 'express'

import Sharp from 'sharp'
import Multer from 'multer'
import FS from 'fs'

import { jwtAuth } from '../../../../Server'
import { Image, SDBaseItem, SDCheckpointItem, SDContainer } from '../../../../db/Schema'
import { appendImageURL } from '../../image/index.ts'
import * as SD from '../../../../types/StableDiffusion.ts'

import Axios from 'axios'
import { downloadQueue, queueCivitAIModel } from '../../../../service/DownloadQueue.ts'

interface QueryParams {
	query?: string
	limit?: string
	type?: SD.ModelType
	sort?: 'Highest Rated' | 'Most Downloaded' | 'Newest'
	period?: 'AllTime' | 'Year' | 'Month' | 'Week' | 'Day'
	nsfw?: boolean
	cursor?: string
}

const router = Router()
router.use(jwtAuth)

router.get('/', async (req, res) => {
	try {
		const params: QueryParams = req.query

		const url = new URL(`${SPARKUI_CORE_CIVITAI_BASE}/v1/models`)
		if (params.query) url.searchParams.append('query', params.query)
		if (params.cursor) url.searchParams.append('cursor', params.cursor)
		if (params.nsfw) url.searchParams.append('nsfw', params.nsfw ? 'true' : 'false')

		if (params.limit) {
			try {
				const limit = Number(params.limit.toString())
				if (!limit || limit < 1 || limit > 50) return res.status(400).json({ error: 'Limit must be between 1 and 50!' })
				url.searchParams.append('limit', params.limit)
			} catch (e) {
				return res.status(400).json({ error: 'Invalid limit' })
			}
		}

		if (params.type) {
			if (!Object.values(SD.ModelType).includes(params.type)) return res.status(400).json({ error: 'Invalid type' })
			url.searchParams.append('type', params.type.toString())
		}

		if (params.sort) {
			if (!['Highest Rated', 'Most Downloaded', 'Newest'].includes(params.sort))
				return res.status(400).json({ error: 'Invalid sort' })
			url.searchParams.append('sort', params.sort)
		}

		if (params.period) {
			if (!['AllTime', 'Year', 'Month', 'Week', 'Day'].includes(params.period))
				return res.status(400).json({ error: 'Invalid period' })
			url.searchParams.append('period', params.period)
		}

		const data = (await Axios.get(url.toString(), { headers: { Authorization: req.headers.authorization } })).data
		return res.json({ meta: { nextCursor: data.metadata.nextCursor }, data: data.items })
	} catch (e) {
		logger.error(e)
		return res.status(500).json({ error: 'Internal Server Error' })
	}
})

router.post('/queue/url', async (req, res) => {
	const jwt = req.user

	if (typeof req.body === 'string') req.body = [req.body]

	const items: any[] = []
	for (let url of req.body) {
		if (!url) {
			items.push([])
			continue
		}
		const data = await queueCivitAIModel(jwt.id, url)
		items.push(data)
	}

	return res.json({ data: { queueLength: downloadQueue.length } })
})

router.get('/queue', async (req, res) => {
	const data: any[] = []
	const jwt = req.user

	for (let i of downloadQueue) {
		if (i.creatorID !== jwt.id) continue
		data.push({
			id: i.id,
			name: i.modelName,
			path: i.path.split('/').pop(),
			status: i.status,
			progress: i.progress,
			sizeMB: i.sizeMB,
			thumbnailHash: i.thumbnailHash,
			downloadStarted: i.downloadStarted,
		})
	}

	return res.json({ data })
})

router.get('/queue/:id/thumbnail', async (req, res) => {
	const id = req.params.id
	const item = downloadQueue.find((i) => i.id === id)
	if (!item) return res.status(404).json({ error: 'Item not found' })

	const image = await Sharp(item.thumbnail).toBuffer()
	return res.setHeader('Content-Type', 'image/webp').send(image)
})

export default router
