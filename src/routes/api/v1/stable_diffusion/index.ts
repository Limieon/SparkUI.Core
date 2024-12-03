import { authMiddleware, JWTRPayload } from '$/service/Auth'
import e, { Router, Request, Response } from 'express'

import db, { coalesce, jsonAgg, jsonAggBuildObject, jsonBuildObject, jsonObjectAgg } from '@db'
import * as Table from '@db/schema'
import { encodeCursor, decodeCursor } from '@db/utils'

import * as Env from '@env'

import FS, { readSync } from 'fs'

import z, { ZodDefault, ZodError, ZodLazy } from 'zod'
import {
	aliasedTable,
	and,
	arrayOverlaps,
	asc,
	count,
	desc,
	DrizzleError,
	eq,
	getTableColumns,
	gt,
	inArray,
	lt,
	lte,
	or,
	sql,
} from 'drizzle-orm'
import { alias, DefaultViewBuilderCore } from 'drizzle-orm/pg-core'
import Logger from '@log'
import { valiadteSchema, validateBodySchema, validateQuerySchema } from '$/Router'

import * as Schemas from './Schemas'
import * as ImageSchemas from '../image/Schemas'
import * as UserSchemas from '../user/Schemas'
import { getSDHashes } from '$/utils/HashUtils'
import { SafeTensors } from '$/utils/FileUtils'

import Path from 'path'

import * as DirUtils from '$/utils/DirUtils'
import { v4 } from 'uuid'

const router = Router()
router.use(authMiddleware)

// ---> Query Endpoints <--- //
// Query Modeles
const getModelsSchema = z.object({
	limit: z.coerce.number().int().max(50).default(20),
	cursor: z.string().nullable().optional(),
	nsfw: z.coerce.number().int().default(0),
	types: z
		.union([z.string(), z.array(z.enum(Table.ESDItemType.enumValues))])
		.transform((v) => (typeof v === 'string' ? (v as string).split(',') : v))
		.default([]),
})
type GetModelsType = z.infer<typeof getModelsSchema>

router.get('/items', validateQuerySchema(getModelsSchema), async (req: Request, res: Response) => {
	const query = req.query as unknown as GetModelsType
	const cursor = query.cursor ? decodeCursor(query.cursor) : null

	try {
		const itemCreator = aliasedTable(Table.User, 'ItemCreator')
		const fileUploader = aliasedTable(Table.User, 'FileUploader')

		const entries: any[] = await db
			.select({
				...getTableColumns(Table.SDBaseItem),
				creator: jsonBuildObject({ id: itemCreator.id, name: itemCreator.name }),
				container: jsonBuildObject({
					...getTableColumns(Table.SDContainer),
				}),
				images: coalesce(
					jsonAgg(
						jsonBuildObject({
							id: Table.Image.id,
						}),
						sql`FILTER (WHERE ${Table.Image.id} IS NOT NULL)`
					),
					'[]'
				),
				files: coalesce(
					jsonAgg(
						jsonBuildObject({
							...getTableColumns(Table.SDModelFile),
							name: Table.SDModelFile.location,
							uploader: jsonBuildObject({
								id: fileUploader.id,
								name: fileUploader.name,
							}),
						}),
						sql`FILTER (WHERE ${Table.SDModelFile.id} IS NOT NULL)`
					),
					'[]'
				),
			})
			.from(Table.SDBaseItem)
			.innerJoin(itemCreator, eq(itemCreator.id, Table.SDBaseItem.creatorId))
			.leftJoin(Table.SDContainer, eq(Table.SDContainer.id, Table.SDBaseItem.containerId))
			.leftJoin(Table.Image, eq(Table.Image.baseItemId, Table.SDBaseItem.id))
			.leftJoin(Table.SDModelFile, eq(Table.SDBaseItem.id, Table.SDModelFile.itemId))
			.leftJoin(fileUploader, eq(fileUploader.id, Table.SDModelFile.uploaderId))
			.where(
				and(
					lte(Table.SDBaseItem.nsfwLevel, query.nsfw),
					cursor
						? or(
								gt(Table.SDBaseItem.createdAt, cursor.createdAt),
								and(eq(Table.SDBaseItem.createdAt, cursor.createdAt), gt(Table.SDBaseItem.id, cursor.id))
						  )
						: undefined
				)
			)
			.groupBy(Table.SDBaseItem.id, itemCreator.id, Table.SDContainer.id)
			.orderBy(asc(Table.SDBaseItem.createdAt), asc(Table.SDBaseItem.id))
			.limit(query.limit + 1)

		if (entries.length < 1) {
			res.status(404).json({ error: 'No matching items found' })
			return
		}

		const data: Schemas.ItemType[] = entries.map((e) => {
			return Schemas.Item.parse({
				...e,
			})
		})

		const count = data.length
		res.json({
			data: data.slice(0, query.limit),
			meta: {
				count,
				nextCursor:
					count > query.limit
						? encodeCursor({
								id: data[count - 1].id,
								createdAt: data[count - 1].createdAt,
						  })
						: null,
			},
		})
	} catch (e) {
		if (e instanceof Error) res.status(500).json({ error: e.message })
		else Logger.debug(e)
	}
})

// Query Contaienrs
const getContainersSchema = z.object({
	limit: z.coerce.number().int().max(50).default(20),
	cursor: z.string().nullable().optional(),
	nsfw: z.coerce.number().int().default(0),
	types: z
		.union([z.string(), z.array(z.enum(Table.ESDItemType.enumValues))])
		.transform((v) => (typeof v === 'string' ? (v as string).split(',') : v))
		.default([]),
})
type GetContainersType = z.infer<typeof getContainersSchema>

router.get('/containers', validateQuerySchema(getContainersSchema), async (req: Request, res: Response) => {
	const query = req.query as unknown as GetContainersType
	const cursor = query.cursor ? decodeCursor(query.cursor) : null

	try {
		const entries = await db
			.select({
				...getTableColumns(Table.SDContainer),
				creator: jsonBuildObject({ id: Table.User.id, name: Table.User.name }),
				items: coalesce(
					jsonAgg(
						jsonBuildObject({
							id: Table.SDBaseItem.id,
							name: Table.SDBaseItem.name,
							description: Table.SDBaseItem.description,
							brief: Table.SDBaseItem.brief,
						}),
						sql`FILTER (WHERE ${Table.SDBaseItem.id} IS NOT NULL)`
					),
					'[]'
				),
			})
			.from(Table.SDContainer)
			.innerJoin(Table.User, eq(Table.User.id, Table.SDContainer.creatorId))
			.leftJoin(Table.SDBaseItem, eq(Table.SDBaseItem.containerId, Table.SDContainer.id))
			.where(
				and(
					and(
						lte(coalesce(Table.SDBaseItem.nsfwLevel, sql`0`), query.nsfw ? query.nsfw : 0),
						query.types.length > 0 ? inArray(Table.SDBaseItem.type, query.types) : undefined
					),
					cursor
						? or(
								gt(Table.SDContainer.createdAt, cursor.createdAt),
								and(eq(Table.SDContainer.createdAt, cursor.createdAt), gt(Table.SDContainer.id, cursor.id))
						  )
						: undefined
				)
			)
			.groupBy(Table.SDContainer.id, Table.User.id)
			.orderBy(asc(Table.SDContainer.createdAt), asc(Table.SDContainer.id))
			.limit(query.limit + 1)

		FS.writeFileSync('test/containers.json', JSON.stringify(entries, null, 4))

		if (entries.length < 1) {
			res.status(404).json({ error: 'No matching items found' })
			return
		}

		const data: Schemas.ContainerType[] = entries.map((e) => Schemas.Container.parse({ ...e }))
		const count = data.length

		res.json({
			data: data.slice(0, query.limit),
			meta: {
				count: count - 1,
				nextCursor:
					count > query.limit
						? encodeCursor({
								id: data[count - 1].id,
								createdAt: data[count - 1].createdAt,
						  })
						: null,
			},
		})
	} catch (e) {
		if (e instanceof Error) res.status(500).json({ error: e.message })
		else Logger.error(e)
	}
})

// Get specific container
const getContainerSchema = z.object({
	cID: z.string(),
})
type GetContainerType = z.infer<typeof getContainerSchema>

router.get('/containers/:cID', validateQuerySchema(getContainerSchema), async (req: Request, res: Response) => {
	const user = req.user
	const query = req.query as unknown as GetContainerType

	try {
		const [entry] = await db
			.select({
				...getTableColumns(Table.SDContainer),
				creator: jsonBuildObject({ id: Table.User.id, name: Table.User.name }),
				items: coalesce(
					jsonAgg(
						jsonBuildObject({
							id: Table.SDBaseItem.id,
							name: Table.SDBaseItem.name,
							description: Table.SDBaseItem.description,
							brief: Table.SDBaseItem.brief,
						}),
						sql`FILTER (WHERE ${Table.SDBaseItem.id} IS NOT NULL)`
					),
					'[]'
				),
			})
			.from(Table.SDContainer)
			.leftJoin(Table.SDBaseItem, eq(Table.SDContainer.id, Table.SDBaseItem.containerId))
			.innerJoin(Table.User, eq(Table.SDContainer.creatorId, Table.User.id))
			.where(eq(Table.SDContainer.id, query.cID))

		if (entry == undefined) {
			res.status(404).json({ error: 'No matching items found' })
			return
		}

		let data: Schemas.ContainerType = Schemas.Container.parse({ ...entry })
		res.json({ data, meta: {} })
	} catch (e) {
		if (e instanceof Error) res.status(500).json({ error: e.message })
		else Logger.error(e)
	}
})

// Get main prview image for container
const getContainerPreviewSchema = z.object({
	cID: z.string(),
	i: z.number().default(0),
})
type GetContainerPreviewType = z.infer<typeof getContainerPreviewSchema>

router.get('/containers/:cID/preview/:i', validateQuerySchema(getContainerPreviewSchema), async (req: Request, res: Response) => {
	const user = req.user
	const query = req.query as unknown as GetContainerPreviewType

	try {
		res.setHeader('Content-Type', 'image/webp')
		res.send(
			(
				await db
					.select()
					.from(Table.Image)
					.innerJoin(Table.SDBaseItem, eq(Table.SDBaseItem.id, Table.Image.baseItemId))
					.where(eq(Table.SDBaseItem.containerId, query.cID))
					.offset(query.i)
					.limit(1)
			)[0].Image.data
		)
	} catch (e) {
		res.setHeader('Content-Type', 'application/json')
		res.status(404).json({ error: 'Container or image not found!' })
	}
})

// Get specific model
const getModelSchema = z.object({
	mID: z.string(),
})
type GetModelType = z.infer<typeof getModelSchema>

router.get('/items/:mID', validateQuerySchema(getModelSchema), async (req: Request, res: Response) => {
	const user = req.user
	const query = req.query as unknown as GetModelType

	try {
		const entries = await db
			.select()
			.from(Table.SDBaseItem)
			.innerJoin(Table.SDContainer, eq(Table.SDContainer.id, Table.SDBaseItem.containerId))
			.leftJoin(Table.Image, eq(Table.Image.baseItemId, Table.SDBaseItem.id))
			.innerJoin(Table.User, eq(Table.User.id, Table.SDBaseItem.creatorId))
			.innerJoin(Table.SDModelFile, eq(Table.SDBaseItem.id, Table.SDModelFile.itemId))
			.innerJoin(aliasedTable(Table.User, 'FileUploader'), eq(Table.User.id, Table.SDModelFile.uploaderId))
			.where(eq(Table.SDBaseItem.id, query.mID))

		if (entries.length < 1) {
			res.status(404).json({ error: 'No matching items found' })
			return
		}

		const data: Schemas.ItemType = Schemas.Item.parse({
			...entries[0].SDBaseItem,
			creator: entries[0].User,
			container: entries[0].SDContainer,
			images: [],
			files: [],
		})

		for (let e of entries) {
			if (e.Image != undefined) data.images.push(ImageSchemas.RefImage.parse(e.Image))
			if (e.SDModelFile != undefined) {
				data.files.push(
					Schemas.ModelFile.parse({
						name: Path.basename(e.SDModelFile.location!),
						uploader: { id: e.FileUploader.id, name: e.FileUploader.name },
						...e.SDModelFile,
					})
				)
			}
		}

		res.status(200).json({ data, meta: {} })
	} catch (e) {
		if (e instanceof Error) res.status(500).json({ error: e.message })
		else Logger.error(e)
	}
})

const getModelFilesSchema = z.object({
	mID: z.string(),
})
type GetModelFilesType = z.infer<typeof getModelFilesSchema>

router.get('/items/:mID/files', validateQuerySchema(getModelFilesSchema), async (req: Request, res: Response) => {
	const user = req.user!
	const query = req.query as unknown as GetModelFilesType

	try {
		const entries = await db
			.select()
			.from(Table.SDModelFile)
			.where(eq(Table.SDModelFile.itemId, query.mID))
			.innerJoin(Table.User, eq(Table.User.id, Table.SDModelFile.uploaderId))

		const data: Schemas.ModelFileType[] = []
		for (let e of entries) {
			data.push(
				Schemas.ModelFile.parse({
					...e.SDModelFile,
					name: Path.basename(e.SDModelFile.location!),
					uploader: e.User,
				})
			)
		}

		res.status(200).json({ data })
	} catch (e) {
		if (e instanceof Error) res.status(500).json({ error: JSON.parse(e.message) })
		else Logger.error(e)
	}
})

// ---> Create Endpoints <--- //
// Create a new container
router.post('/containers', validateBodySchema(Schemas.UpdateContainer), async (req: Request, res: Response) => {
	const user = req.user!

	try {
		const data = req.body as Schemas.UpdateContainerType
		const inserted = (
			await db
				.insert(Table.SDContainer)
				.values({
					...data,
					creatorId: user.sub,
				})
				.returning()
		)[0]

		const result: Schemas.RefContainerType = {
			id: inserted.id,
			name: inserted.name!,
			description: inserted.description!,
			brief: inserted.brief!,
		}

		res.status(200).json({
			message: 'Successfully inserted container!',
			data: result,
		})
	} catch (e) {
		if (e instanceof ZodError) {
			res.status(400).json({ error: e.errors })
			return
		}

		res.status(500).json({ error: e.message })
	}
})

// Delete a container if no models are assigned to it
const deleteContainerSchema = z.object({
	cID: z.string().uuid(),
})
type DeleteContainerType = z.infer<typeof deleteContainerSchema>

router.delete('/containers/:cID', validateQuerySchema(deleteContainerSchema), async (req: Request, res: Response) => {
	const query = req.query as unknown as DeleteContainerType

	const user = req.user
	if (!user) {
		res.status(401).json({ error: 'User not found' })
		return
	}

	try {
		const containers = await db.select().from(Table.SDContainer).where(eq(Table.SDContainer.id, query.cID))

		if (containers.length < 1) {
			res.status(400).json({ error: 'Container not found' })
			return
		}

		const data = containers[0]
		if (data.creatorId !== user.sub) {
			res.status(403).json({
				error: 'You are not the creator of this container',
			})
			return
		}

		if (
			(await db.select({ id: Table.SDBaseItem.id }).from(Table.SDBaseItem).where(eq(Table.SDBaseItem.containerId, data.id)).limit(1))
				.length > 0
		) {
			res.status(400).json({ error: 'Container is not empty' })
			return
		}

		await db.delete(Table.SDContainer).where(eq(Table.SDContainer.id, data.id))

		res.status(200).json({ message: 'Successfully deleted container' })
	} catch (e) {
		res.status(500).json({ error: e.message })
	}
})

// Create a new model
async function createDefaultItem(item: Schemas.UpdateItemType, containerID: string, creatorID: string): Promise<string> {
	const data = (
		await db
			.insert(Table.SDBaseItem)
			.values({
				type: item.type,
				name: item.name,
				description: item.description,
				brief: item.brief,
				version: item.version,
				usedInBatches: item.usedInBatches,
				usedInImages: item.usedInImages,
				nsfw: item.nsfw,
				nsfwLevel: item.nsfwLevel,
				trainingType: item.trainingType,
				containerId: containerID,
				creatorId: creatorID,
			})
			.returning({ id: Table.SDBaseItem.id })
	)[0]
	return data.id
}

const modelRoutes = {
	checkpoint: {
		schema: Schemas.CheckpointItem,
		updateSchema: Schemas.UpdateCheckpointItem,
		table: Table.SDCheckpointItem,
	},
	lora: {
		schema: Schemas.LoraItem,
		updateSchema: Schemas.UpdateLoraItem,
		table: Table.SDLoraItem,
	},
	embedding: {
		schema: Schemas.EmbeddingItem,
		updateSchema: Schemas.UpdateEmbeddingItem,
		table: Table.SDEmbeddingItem,
	},
	vae: {
		schema: Schemas.VAEItem,
		updateSchema: Schemas.UpdateVAEItem,
		table: Table.SDVAEItem,
	},
	controlnet: {
		schema: Schemas.ControlNetItem,
		updateSchema: Schemas.UpdateControlNetItem,
		table: Table.SDControlNetItem,
	},
	controlnet_preprocessor: {
		schema: Schemas.ControlNetPreprocessorItem,
		updateSchema: Schemas.UpdateControlNetPreprocessorItem,
		table: Table.SDControlNetPreProcessorItem,
	},
}

for (const [key, value] of Object.entries(modelRoutes)) {
	router.post(
		`/:containerID/items/${key}`,
		valiadteSchema(z.object({ containerID: z.string().uuid() }), value.updateSchema),
		async (req: Request, res: Response) => {
			const user = req.user!
			const data = req.body as z.infer<typeof value.updateSchema>
			const containerID = req.params.containerID

			try {
				const itemID = await createDefaultItem(data, containerID, user.sub)
				await db.insert(value.table).values({ id: itemID, ...data })

				res.status(200).json({ message: 'Successfully created model', data: { id: itemID } })
			} catch (e) {
				res.status(500).json({ error: "Couldn't create model", details: Env.SPARKUI_CORE_DEBUG ? e.message : undefined })
			}
		}
	)
}

router.put('/items/:mID/file', async (req: Request, res: Response) => {
	const user = req.user!

	try {
		const itemData = (await db.select().from(Table.SDBaseItem).where(eq(Table.SDBaseItem.id, req.params.mID)))[0]
		if (itemData.creatorId !== user.sub) {
			res.status(403).json({ error: 'You are not the creator of this model' })
			return
		}

		const tempFilePath = DirUtils.getTempFilePath()
		const writeStream = FS.createWriteStream(tempFilePath)

		Logger.debug({ tempFilePath })
		req.pipe(writeStream)

		req.on('end', async () => {
			Logger.debug('File upload complete')

			const hashes = await getSDHashes(tempFilePath)
			const size = FS.statSync(tempFilePath).size / (1024 * 1024) // MB

			try {
				const header = await SafeTensors.getHeader(tempFilePath)
				FS.writeFileSync('./header.json', JSON.stringify(header, null, 4))

				const precision = SafeTensors.getDType(header)

				const itemPath = DirUtils.getModelFilePath(itemData.name, 'safetensors', itemData.type)
				const itemDir = Path.dirname(itemPath)
				if (!FS.existsSync(itemDir)) FS.mkdirSync(itemDir, { recursive: true })

				Logger.debug('Moving file to', itemPath)
				FS.renameSync(tempFilePath, itemPath)

				const data = (
					await db
						.insert(Table.SDModelFile)
						.values({
							location: itemPath,
							precision,
							sizeType: 'Unknown',
							sha1: hashes.sha1.slice(0, 40),
							sha256: hashes.sha256.slice(0, 64),
							modelHash: hashes.modelHash.slice(0, 16),
							sizeMB: size,
							itemId: itemData.id,
							uploaderId: user.sub,
							format: 'SafeTensors',
						})
						.returning()
				)[0]
				res.status(200).json({ message: 'File uploaded', data })
				return
			} catch (e) {
				Logger.error(e)
				res.status(500).json({ error: 'Could not read header', detail: Env.SPARKUI_CORE_DEBUG ? e.message : undefined })
				return
			}

			res.status(200).json({ message: 'File uploaded' })
		})
		req.on('error', (e) => {
			Logger.error(e)
			res.status(500).json({ error: 'Could not upload file!', detail: Env.SPARKUI_CORE_DEBUG ? e.message : undefined })
		})
	} catch (e) {
		res.status(500).json({ error: 'Failed retreiving item', details: Env.SPARKUI_CORE_DEBUG ? e.message : undefined })
		return
	}
})

// Delete a model
router.delete('/items/:mID', async (req: Request, res: Response) => {
	const QueryParams = z.object({
		mID: z.string().uuid(),
	})
	type QueryType = z.infer<typeof QueryParams>
	const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })

	const user = req.user
	if (!user) {
		res.status(401).json({ error: 'User not found' })
		return
	}

	try {
		const models = await db.select().from(Table.SDBaseItem).where(eq(Table.SDBaseItem.id, query.mID))

		if (models.length < 1) {
			res.status(400).json({ error: 'Model not found' })
			return
		}

		const data = models[0]
		if (data.creatorId !== user.sub) {
			res.status(403).json({
				error: 'You are not the creator of this model',
			})
			return
		}

		await db.delete(Table.SDBaseItem).where(eq(Table.SDBaseItem.id, data.id))

		res.status(200).json({ message: 'Successfully deleted model' })
	} catch (e) {
		res.status(500).json({ error: e.message })
	}
})

// ---> Mutate Endpoints <--- //
// Edit a containers meta
router.patch('/containers/:cID', async (req: Request, res: Response) => {
	const QueryParams = z.object({
		cID: z.string().uuid(),
	})
	type QueryType = z.infer<typeof QueryParams>
	const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })

	const user = req.user
	if (!user) {
		res.status(401).json({ error: 'User not found' })
		return
	}

	try {
		const data = Schemas.UpdateContainer.partial().parse(req.body)
		const containers = await db.select().from(Table.SDContainer).where(eq(Table.SDContainer.id, query.cID))

		if (containers.length < 1) {
			res.status(400).json({ error: 'Container not found' })
			return
		}

		const container = containers[0]
		if (container.creatorId !== user.sub) {
			res.status(403).json({
				error: 'You are not the creator of this container',
			})
			return
		}

		Logger.debug(data)

		await db.update(Table.SDContainer).set(data).where(eq(Table.SDContainer.id, container.id))

		res.status(200).json({ message: 'Successfully updated container' })
	} catch (e) {
		if (e instanceof ZodError) {
			res.status(400).json({ error: e.errors })
			return
		}
		res.status(500).json({ error: e.message })
	}
})

// Add a model to a container
router.put('/containers/:cID/item/:mID', async (req: Request, res: Response) => {
	const QueryParams = z.object({
		cID: z.string().uuid(),
		mID: z.string().uuid(),
	})
	type QueryType = z.infer<typeof QueryParams>
	const query: QueryType = QueryParams.parse({
		...req.query,
		...req.params,
	})

	const user = req.user
	if (!user) {
		res.status(401).json({ error: 'User not found' })
		return
	}

	try {
		const container = await db
			.select({ creatorID: Table.SDContainer.creatorId })
			.from(Table.SDContainer)
			.where(eq(Table.SDContainer.id, query.cID))
			.limit(1)
		if (container.length < 1) {
			res.status(400).json({ error: 'Container not found' })
			return
		}

		const c = container[0]
		if (c.creatorID !== user.sub) {
			res.status(403).json({
				error: 'You are not the creator of this container',
			})
			return
		}

		const model = await db
			.select({ creatorID: Table.SDBaseItem.creatorId })
			.from(Table.SDBaseItem)
			.where(eq(Table.SDBaseItem.id, query.mID))
			.limit(1)
		if (model.length < 1) {
			res.status(400).json({ error: 'Model not found' })
			return
		}

		const m = model[0]
		if (m.creatorID !== user.sub) {
			res.status(403).json({
				error: 'You are not the creator of this model',
			})
			return
		}

		await db.update(Table.SDBaseItem).set({ containerId: query.cID }).where(eq(Table.SDBaseItem.id, query.mID))

		res.status(200).json({ message: 'Successfully added model' })
	} catch (e) {
		if (e instanceof ZodDefault) {
			res.status(400).json({ error: e })
			return
		}
		res.status(500).json({ error: e.message })
	}
})

// Edit a models meta
const patchItemQuerySchema = z.object({
	cID: z.string().uuid(),
	mID: z.string().uuid(),
})
type PatchItemQueryType = z.infer<typeof patchItemQuerySchema>

router.patch('/items/:mID', validateQuerySchema(patchItemQuerySchema), async (req: Request, res: Response) => {
	const query = req.query as unknown as PatchItemQueryType

	const user = req.user
	if (!user) {
		res.status(401).json({ error: 'User not found' })
		return
	}

	try {
		const data = Schemas.UpdateItem.partial().parse(req.body)
		const models = await db.select().from(Table.SDBaseItem).where(eq(Table.SDBaseItem.id, query.mID))

		if (models.length < 1) {
			res.status(400).json({ error: 'Model not found' })
			return
		}

		const model = models[0]
		if (model.creatorId !== user.sub) {
			res.status(403).json({
				error: 'You are not the creator of this model',
			})
			return
		}

		await db.update(Table.SDBaseItem).set(data).where(eq(Table.SDBaseItem.id, model.id))

		res.status(200).json({ message: 'Successfully updated model' })
	} catch (e) {
		if (e instanceof ZodError) {
			res.status(400).json({ error: e.errors })
			return
		}
		res.status(500).json({ error: e.message })
	}
})

export default router
