import { authMiddleware } from '$/service/Auth'
import e, { Router, Request, Response } from 'express'

import { RefUserSchema, UserSchema } from '$/routes/api/v1/user'
import { ImageSchema, ImageType, RefImageSceham } from '$/routes/api/v1/image'

import db from '@db'
import * as Table from '@db/schema'
import { encodeCursor, decodeCursor } from '@db/utils'

import FS, { readSync } from 'fs'

import z, { ZodError } from 'zod'
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

export const RefItemSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string(),
    brief: z.string(),
})
export type RefItemType = z.infer<typeof RefItemSchema>
export const RefContainerSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    brief: z.string(),
})
export type RefContainerType = z.infer<typeof RefContainerSchema>

export const ContainerSchema = z.object({
    id: z.string().uuid(),

    name: z.string(),
    description: z.string(),
    brief: z.string(),

    creator: RefUserSchema,
    items: z.array(RefItemSchema),

    createdAt: z.date(),
    updatedAt: z.date(),
})
export type ContainerType = z.infer<typeof ContainerSchema>
export const UpdateContainerSchema = ContainerSchema.omit({
    id: true,
    items: true,
    creator: true,
    createdAt: true,
    updatedAt: true,
})
export type UpdateContainerType = z.infer<typeof UpdateContainerSchema>

export const ItemSchema = z.object({
    id: z.string().uuid(),

    type: z.enum(Table.SDBaseItem.type.enumValues),
    name: z.string(),
    description: z.string(),
    brief: z.string(),
    version: z.string(),
    usedInBatches: z.number().int(),
    usedInImages: z.number().int(),
    nsfw: z.boolean(),
    nsfwLevel: z.number().int(),
    trainingType: z.enum(Table.SDBaseItem.trainingType.enumValues),

    container: RefContainerSchema,
    creator: RefUserSchema,
    images: z.array(RefImageSceham),

    createdAt: z.date(),
    updatedAt: z.date(),
    lastUsedAt: z.date().nullable(),
})
export type ItemType = z.infer<typeof ItemSchema>
export const UpdateItemSchema = ItemSchema.omit({
    id: true,
    container: true,
    creator: true,
    images: true,
    createdAt: true,
    updatedAt: true,
    lastUsedAt: true,
})
export type UpdateItemType = z.infer<typeof UpdateItemSchema>

const router = Router()
router.use(authMiddleware)

// ---> Query Endpoints <--- //
// Query Modeles
router.get('/models', async (req: Request, res: Response) => {
    const QueryParams = z.object({
        limit: z.coerce.number().int().max(50).default(20),
        cursor: z.string().nullable().optional(),
        nsfw: z.coerce.number().int().default(0),
        types: z
            .union([z.string(), z.array(z.enum(Table.ESDItemType.enumValues))])
            .transform((v) =>
                typeof v === 'string' ? (v as string).split(',') : v
            )
            .default([]),
    })
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })

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
                                  gt(
                                      Table.SDBaseItem.createdAt,
                                      cursor.createdAt
                                  ),
                                  and(
                                      eq(
                                          Table.SDBaseItem.createdAt,
                                          cursor.createdAt
                                      ),
                                      gt(Table.SDBaseItem.id, cursor.id)
                                  )
                              )
                            : undefined
                    )
                    .limit(query.limit + 1)
                    .as('SDBaseItem')
            )
            .where(
                and(
                    lte(
                        Table.SDBaseItem.nsfwLevel,
                        query.nsfw ? query.nsfw : 0
                    ),
                    query.types.length > 0
                        ? inArray(Table.SDBaseItem.type, query.types)
                        : undefined
                )
            )
            .innerJoin(
                Table.User,
                eq(Table.User.id, Table.SDBaseItem.creatorId)
            )
            .leftJoin(
                Table.SDContainer,
                eq(Table.SDContainer.id, Table.SDBaseItem.containerId)
            )
            .leftJoin(
                Table.Image,
                eq(Table.Image.baseItemId, Table.SDBaseItem.id)
            )

        if (entries.length < 1) {
            res.status(404).json({ error: 'No matching items found' })
            return
        }

        const data: ItemType[] = []
        let lastID: string | null = null
        for (let e of entries) {
            const { id } = e.SDBaseItem
            if (lastID !== id) {
                data.push(
                    ItemSchema.parse({
                        ...e.SDBaseItem,
                        creator: e.User,
                        container: e.SDContainer,
                        images: [],
                    })
                )

                lastID = id
            }

            if (e.Image == undefined) continue
            data[data.length - 1].images.push(RefImageSceham.parse(e.Image))
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
router.get('/containers', async (req: Request, res: Response) => {
    const QueryParams = z.object({
        limit: z.coerce.number().int().max(50).default(20),
        cursor: z.string().nullable().optional(),
        nsfw: z.coerce.number().int().default(0),
        types: z
            .union([z.string(), z.array(z.enum(Table.ESDItemType.enumValues))])
            .transform((v) =>
                typeof v === 'string' ? (v as string).split(',') : v
            )
            .default([]),
    })
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })
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
                                  gt(
                                      Table.SDContainer.createdAt,
                                      cursor.createdAt
                                  ),
                                  and(
                                      eq(
                                          Table.SDContainer.createdAt,
                                          cursor.createdAt
                                      ),
                                      gt(Table.SDContainer.id, cursor.id)
                                  )
                              )
                            : undefined
                    )
                    .limit(query.limit + 1)
                    .as('SDContainer')
            )
            .innerJoin(
                Table.User,
                eq(Table.User.id, Table.SDContainer.creatorId)
            )
            .leftJoin(
                Table.SDBaseItem,
                eq(Table.SDBaseItem.containerId, Table.SDContainer.id)
            )
            .where(
                and(
                    lte(
                        Table.SDBaseItem.nsfwLevel,
                        query.nsfw ? query.nsfw : 0
                    ),
                    query.types.length > 0
                        ? inArray(Table.SDBaseItem.type, query.types)
                        : undefined
                )
            )

        if (entries.length < 1) {
            res.status(404).json({ error: 'No matching items found' })
            return
        }

        let lastID: string | null = null
        const data: ContainerType[] = []
        for (let e of entries) {
            const { id } = e.SDContainer
            if (lastID !== id) {
                data.push(
                    ContainerSchema.parse({
                        ...e.SDContainer,
                        creator: e.User,
                        items: [],
                    })
                )
                lastID = id
            }

            if (e.SDBaseItem == undefined) continue
            data[data.length - 1].items.push(RefItemSchema.parse(e.SDBaseItem))
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
router.get('/containers/:cID', async (req: Request, res: Response) => {
    const user = req.user

    const QueryParams = z.object({
        cID: z.string(),
    })
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })

    try {
        const entries = await db
            .select()
            .from(Table.SDContainer)
            .leftJoin(
                Table.SDBaseItem,
                eq(Table.SDContainer.id, Table.SDBaseItem.containerId)
            )
            .innerJoin(
                Table.User,
                eq(Table.SDContainer.creatorId, Table.User.id)
            )
            .where(eq(Table.SDContainer.id, query.cID))

        if (entries.length < 1) {
            res.status(404).json({ error: 'No matching items found' })
            return
        }

        FS.writeFileSync('test/data.json', JSON.stringify(entries, null, 4))

        let data: ContainerType = ContainerSchema.parse({
            ...entries[0].SDContainer,
            creator: entries[0].User,
            items: [],
        })
        for (let e of entries) {
            if (e.SDBaseItem == undefined) continue
            data.items.push(RefItemSchema.parse(e.SDBaseItem))
        }

        res.json({ data, meta: {} })
    } catch (e) {
        if (e instanceof Error) res.status(500).json({ error: e.message })
        else Logger.error(e)
    }
})

// Get main prview image for container
router.get(
    '/containers/:cID/preview/:i',
    async (req: Request, res: Response) => {
        const QueryParams = z.object({
            cID: z.string(),
            i: z.coerce.number().default(0),
        })
        type QueryType = z.infer<typeof QueryParams>
        const query: QueryType = QueryParams.parse({
            ...req.query,
            ...req.params,
        })

        try {
            res.setHeader('Content-Type', 'image/webp')
            res.send(
                (
                    await db
                        .select()
                        .from(Table.Image)
                        .innerJoin(
                            Table.SDBaseItem,
                            eq(Table.SDBaseItem.id, Table.Image.baseItemId)
                        )
                        .where(eq(Table.SDBaseItem.containerId, query.cID))
                        .offset(query.i)
                        .limit(1)
                )[0].Image.data
            )
        } catch (e) {
            res.setHeader('Content-Type', 'application/json')
            res.status(404).json({ error: 'Container or image not found!' })
        }
    }
)

// Get specific model
router.get('/models/:mID', async (req: Request, res: Response) => {
    const QueryParams = z.object({
        mID: z.string().uuid(),
    })
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })
    const user = req.user

    try {
        const entries = await db
            .select()
            .from(Table.SDBaseItem)
            .innerJoin(
                Table.SDContainer,
                eq(Table.SDContainer.id, Table.SDBaseItem.containerId)
            )
            .leftJoin(
                Table.Image,
                eq(Table.Image.baseItemId, Table.SDBaseItem.id)
            )
            .innerJoin(
                Table.User,
                eq(Table.User.id, Table.SDBaseItem.creatorId)
            )
            .where(eq(Table.SDBaseItem.id, query.mID))

        if (entries.length < 1) {
            res.status(404).json({ error: 'No matching items found' })
            return
        }

        const data: ItemType = ItemSchema.parse({
            ...entries[0].SDBaseItem,
            creator: entries[0].User,
            container: entries[0].SDContainer,
            images: [],
        })

        for (let e of entries) {
            if (e.Image == undefined) continue
            data.images.push(RefImageSceham.parse(e.Image))
        }

        res.status(200).json({ data, meta: {} })
    } catch (e) {
        if (e instanceof Error) res.status(500).json({ error: e.message })
        else Logger.error(e)
    }
})

// ---> Create Endpoints <--- //
// Create a new container
router.post('/containers', async (req: Request, res: Response) => {
    const QueryParams = z.object({})
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })

    const user = req.user
    if (!user) {
        res.status(401).json({ error: 'User not found' })
        return
    }

    try {
        const data = UpdateContainerSchema.parse(req.body)
        const inserted = (
            await db
                .insert(Table.SDContainer)
                .values({
                    ...data,
                    creatorId: user?.sub,
                })
                .returning()
        )[0]

        const result: RefContainerType = {
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
router.delete('/containers/:cID', async (req: Request, res: Response) => {
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
        const containers = await db
            .select()
            .from(Table.SDContainer)
            .where(eq(Table.SDContainer.id, query.cID))

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
            (
                await db
                    .select({ id: Table.SDBaseItem.id })
                    .from(Table.SDBaseItem)
                    .where(eq(Table.SDBaseItem.containerId, data.id))
                    .limit(1)
            ).length > 0
        ) {
            res.status(400).json({ error: 'Container is not empty' })
            return
        }

        await db
            .delete(Table.SDContainer)
            .where(eq(Table.SDContainer.id, data.id))

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
        const data = UpdateItemSchema.parse(req.body)
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

        const result: RefItemType = {
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
        const models = await db
            .select()
            .from(Table.SDBaseItem)
            .where(eq(Table.SDBaseItem.id, query.mID))

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

        await db
            .delete(Table.SDBaseItem)
            .where(eq(Table.SDBaseItem.id, data.id))

        res.status(200).json({ message: 'Successfully deleted model' })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

// ---> Mutate Endpoints <--- //
// Edit a containers meta
router.patch('/containers/:cID', async (req: Request, res: Response) => {
    const user = req.user
})

// Add a model to a container
router.put(
    '/containers/:cID/model/:mID',
    async (req: Request, res: Response) => {
        const user = req.user
    }
)

// Edit a models meta
router.patch('/models/:mID', async (req: Request, res: Response) => {
    const user = req.user
})

// Add a tag to a model
router.put('/models/:mID/tag/:tag', async (req: Request, res: Response) => {
    const user = req.user
})

// Remove a tag from a model
router.delete('/models/:mID/tag/:tag', async (req: Request, res: Response) => {
    const user = req.user
})

export default router
