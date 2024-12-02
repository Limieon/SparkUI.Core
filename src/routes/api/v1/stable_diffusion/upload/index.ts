import { authMiddleware } from '$/service/Auth'
import { Router, Request, Response, NextFunction } from 'express'
import Logger from '@log'

import FS from 'fs'

import { z } from 'zod'
import { validateBodySchema } from '$/Router'

import { getSDHashes } from '$/utils/HashUtils'

import * as DirUtils from '$/utils/DirUtils'

import * as Env from '@env'

import Multer from 'multer'
import { httpClient } from '$/utils/CivitAIUtils'
import db from '@db'
import * as Table from '@db/schema'
import { EModelPrecision, EModelSizeType, ESDItemType } from '$/utils/TypeUtils'

import Path from 'path'

const upload = Multer({
	storage: Multer.memoryStorage(),
	limits: {
		fileSize: 50 * 1024 * 1024 * 1024, // 50GB
	},
})

const router = Router()
router.use(authMiddleware)

const postImportSchema = z.object({
	directory: z.string(),
})
type PostImportType = z.infer<typeof postImportSchema>

router.post('/single', async (req: Request, res: Response) => {
	const user = req.user!
	const tempFilePath = DirUtils.getTempFilePath()
	const writeStream = FS.createWriteStream(tempFilePath)

	Logger.debug({ tempFilePath })
	req.pipe(writeStream)

	req.on('end', async () => {
		Logger.debug('End of stream')
		const hashes = await getSDHashes(tempFilePath)
		const meta = (await httpClient.get(`https://civitai.com/api/v1/model-versions/by-hash/${hashes.modelHash.slice(0, 12)}`)).data

		FS.writeFileSync('./test.json', JSON.stringify(meta, null, 4))

		let modelType: ESDItemType = 'Other'
		switch (meta.model.type.toLowerCase()) {
			case 'checkpoint':
				modelType = 'Checkpoint'
				break
			case 'lora':
				modelType = 'Lora'
				break
			case 'textualinversion':
				modelType = 'Embedding'
				break
		}

		let modelPrecision: EModelPrecision = 'BF16'
		switch (meta.files[0].metadata.fp.toLowerCase()) {
			case 'fp16':
				modelPrecision = 'FP16'
				break
			case 'fp32':
				modelPrecision = 'FP32'
				break
			case 'bf16':
				modelPrecision = 'BF16'
				break
		}

		let modelSizeType: EModelSizeType = 'Unknown'
		switch (meta.files[0].metadata.size.toLowerCase()) {
			case 'pruned':
				modelSizeType = 'Pruned'
				break
			case 'full':
				modelSizeType = 'Full'
				break
		}

		const filePath = DirUtils.getModelFilePath(`${meta.model.name}_${meta.name}`, 'safetensors', modelType)
		FS.renameSync(tempFilePath, filePath)

		Logger.debug('Inserting container data...')
		const containerData = (
			await db
				.insert(Table.SDContainer)
				.values({
					name: meta.model.name,
					description: '',
					brief: '',
					creatorId: user.sub,
				})
				.returning()
		)[0]

		Logger.debug('Inserting model data...')
		const modelData = (
			await db
				.insert(Table.SDBaseItem)
				.values({
					type: modelType,
					name: meta.name,
					description: meta.description,
					brief: '',
					version: '',
					nsfw: meta.model.nsfw,
					nsfwLevel: meta.model.nsfw ? 1 : 0,
					trainingType: 'Unknown',
					containerId: containerData.id,
					creatorId: user.sub,
				})
				.returning()
		)[0]

		Logger.debug('Inserting file data...')
		const modelFile = (
			await db
				.insert(Table.SDModelFile)
				.values({
					location: Path.relative(Env.SPARKUI_CORE_DATA_DIR, filePath),
					format: 'SafeTensors',
					precision: modelPrecision,
					sizeType: modelSizeType,
					sha1: hashes.sha1.slice(0, 40),
					sha256: hashes.sha256.slice(0, 64),
					modelHash: hashes.modelHash.slice(0, 16),
					sizeMB: 0,
					itemId: modelData.id,
					uploaderId: user.sub,
				})
				.returning()
		)[0]

		Logger.debug('Inserting item specific data...')
		if (modelType === 'Checkpoint') {
			await db.insert(Table.SDCheckpointItem).values({
				id: modelData.id,
				refiner: false,
			})
		} else if (modelType === 'Lora') {
			let triggerWords: string[] = []
			if (meta.trainedWords) {
				for (let d of meta.trainedWords) {
					let pair: string[] = []
					for (let w of d.split(',')) {
						pair.push(w.trim())
					}
					triggerWords.push(pair.join(', '))
				}
			}

			await db.insert(Table.SDLoraItem).values({
				id: modelData.id,
				triggerWords: triggerWords.join('; '),
			})
		} else if (modelType === 'Embedding') {
			let triggerWords: string[] = []
			if (meta.trainedWords) {
				for (let d of meta.trainedWords) {
					let pair: string[] = []
					for (let w of d.split(',')) {
						pair.push(w.trim())
					}
					triggerWords.push(pair.join(', '))
				}
			}

			await db.insert(Table.SDEmbeddingItem).values({
				id: modelData.id,
				triggerWords: triggerWords.join('; '),
			})
		}

		res.status(200).json({ data: { containerData, modelData, modelFile } })
	})
	req.on('error', (err) => {
		FS.unlink(tempFilePath, () => {})
		res.status(500).json({ error: 'File upload failed!', details: Env.SPARKUI_CORE_DEBUG ? err : undefined })
	})
	writeStream.on('error', (err) => {
		FS.unlink(tempFilePath, () => {})
		res.status(500).json({ error: 'File upload failed!', details: Env.SPARKUI_CORE_DEBUG ? err : undefined })
	})
})

export default router
