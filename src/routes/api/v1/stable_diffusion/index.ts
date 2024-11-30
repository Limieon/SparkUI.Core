import { authMiddleware, JWTRPayload } from '$/service/Auth'
import e, { Router, Request, Response } from 'express'

import { RefUserSchema, UserSchema } from '$/routes/api/v1/user'
import { ImageSchema, ImageType, RefImageSchema } from '$/routes/api/v1/image'

import db from '@db'
import * as Table from '@db/schema'
import { encodeCursor, decodeCursor } from '@db/utils'

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
	lte,
	or,
	sql,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import Logger from '@log'
import { valiadteSchema, validateBodySchema, validateQuerySchema } from '$/Router'

import * as Schemas from './Schemas'

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

router.get('/models', validateQuerySchema(getModelsSchema), async (req: Request, res: Response) => {
	const query = req.query as unknown as GetModelsType
	const cursor = query.cursor ? decodeCursor(query.cursor) : null

	try {
		const entries = await db
			.select()
			.from(
				db
					.select()
					.from(Table.SDBaseItem)
					.where(
						cursor
							? or(
									gt(Table.SDBaseItem.createdAt, cursor.createdAt),
									and(eq(Table.SDBaseItem.createdAt, cursor.createdAt), gt(Table.SDBaseItem.id, cursor.id))
							  )
							: undefined
					)
					.limit(query.limit + 1)
					.as('SDBaseItem')
			)
			.where(
				and(
					lte(Table.SDBaseItem.nsfwLevel, query.nsfw ? query.nsfw : 0),
					query.types.length > 0 ? inArray(Table.SDBaseItem.type, query.types) : undefined
				)
			)
			.innerJoin(Table.User, eq(Table.User.id, Table.SDBaseItem.creatorId))
			.leftJoin(Table.SDContainer, eq(Table.SDContainer.id, Table.SDBaseItem.containerId))
			.leftJoin(Table.Image, eq(Table.Image.baseItemId, Table.SDBaseItem.id))

		if (entries.length < 1) {
			res.status(404).json({ error: 'No matching items found' })
			return
		}

		const data: Schemas.ItemType[] = []
		let lastID: string | null = null
		for (let e of entries) {
			const { id } = e.SDBaseItem
			if (lastID !== id) {
				data.push(
					Schemas.Item.parse({
						...e.SDBaseItem,
						creator: e.User,
						container: e.SDContainer,
						images: [],
					})
				)

				lastID = id
			}

			if (e.Image == undefined) continue
			data[data.length - 1].images.push(RefImageSchema.parse(e.Image))
		}
		const count = data.length

		res.json({
			data: data.slice(0, query.limit),
			meta: {
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
			.select()
			.from(
				db
					.select()
					.from(Table.SDContainer)
					.where(
						cursor
							? or(
									gt(Table.SDContainer.createdAt, cursor.createdAt),
									and(eq(Table.SDContainer.createdAt, cursor.createdAt), gt(Table.SDContainer.id, cursor.id))
							  )
							: undefined
					)
					.limit(query.limit + 1)
					.as('SDContainer')
			)
			.innerJoin(Table.User, eq(Table.User.id, Table.SDContainer.creatorId))
			.leftJoin(Table.SDBaseItem, eq(Table.SDBaseItem.containerId, Table.SDContainer.id))
			.where(
				and(
					lte(Table.SDBaseItem.nsfwLevel, query.nsfw ? query.nsfw : 0),
					query.types.length > 0 ? inArray(Table.SDBaseItem.type, query.types) : undefined
				)
			)

		if (entries.length < 1) {
			res.status(404).json({ error: 'No matching items found' })
			return
		}

		let lastID: string | null = null
		const data: Schemas.ContainerType[] = []
		for (let e of entries) {
			const { id } = e.SDContainer
			if (lastID !== id) {
				data.push(
					Schemas.Container.parse({
						...e.SDContainer,
						creator: e.User,
						items: [],
					})
				)
				lastID = id
			}

			if (e.SDBaseItem == undefined) continue
			data[data.length - 1].items.push(Schemas.RefItem.parse(e.SDBaseItem))
		}
		const count = data.length

		res.json({
			data: data.slice(0, query.limit),
			meta: {
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
		const entries = await db
			.select()
			.from(Table.SDContainer)
			.leftJoin(Table.SDBaseItem, eq(Table.SDContainer.id, Table.SDBaseItem.containerId))
			.innerJoin(Table.User, eq(Table.SDContainer.creatorId, Table.User.id))
			.where(eq(Table.SDContainer.id, query.cID))

		if (entries.length < 1) {
			res.status(404).json({ error: 'No matching items found' })
			return
		}

		FS.writeFileSync('test/data.json', JSON.stringify(entries, null, 4))

		let data: Schemas.ContainerType = Schemas.Container.parse({
			...entries[0].SDContainer,
			creator: entries[0].User,
			items: [],
		})
		for (let e of entries) {
			if (e.SDBaseItem == undefined) continue
			data.items.push(Schemas.RefItem.parse(e.SDBaseItem))
		}

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

router.get('/models/:mID', validateQuerySchema(getModelSchema), async (req: Request, res: Response) => {
	const user = req.user
	const query = req.query as unknown as GetModelType

	try {
		const entries = await db
			.select()
			.from(Table.SDBaseItem)
			.innerJoin(Table.SDContainer, eq(Table.SDContainer.id, Table.SDBaseItem.containerId))
			.leftJoin(Table.Image, eq(Table.Image.baseItemId, Table.SDBaseItem.id))
			.innerJoin(Table.User, eq(Table.User.id, Table.SDBaseItem.creatorId))
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
		})

		for (let e of entries) {
			if (e.Image == undefined) continue
			data.images.push(RefImageSchema.parse(e.Image))
		}

		res.status(200).json({ data, meta: {} })
	} catch (e) {
		if (e instanceof Error) res.status(500).json({ error: e.message })
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
router.post('/models', async (req: Request, res: Response) => {
	const QueryParams = z.object({
		cID: z.string().uuid().optional(),
	})
	type QueryType = z.infer<typeof QueryParams>
	const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })

	const user = req.user
	if (!user) {
		res.status(401).json({ error: 'User not found' })
		return
	}

	Logger.debug(query)
	Logger.debug(req.query)

	try {
		const data = Schemas.UpdateItem.parse(req.body)
		const inserted = (
			await db
				.insert(Table.SDBaseItem)
				.values({
					...data,
					containerId: query.cID,
					creatorId: user?.sub,
				})
				.returning()
		)[0]

		const result: Schemas.RefItemType = {
			id: inserted.id,
			brief: inserted.brief!,
			name: inserted.name!,
			description: inserted.description!,
		}

		res.status(200).json({
			message: 'Successfully inserted model!',
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

// Delete a model
router.delete('/models/:mID', async (req: Request, res: Response) => {
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
router.put('/containers/:cID/model/:mID', async (req: Request, res: Response) => {
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

router.patch('/models/:mID', validateQuerySchema(patchItemQuerySchema), async (req: Request, res: Response) => {
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
