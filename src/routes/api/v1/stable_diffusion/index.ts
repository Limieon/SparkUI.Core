import { authMiddleware } from '$/service/Auth'
import e, { Router, Request, Response } from 'express'

import { RefUserSchema, UserSchema } from '$/routes/api/v1/user'
import { ImageSchema, ImageType, RefImageSceham } from '$/routes/api/v1/image'

import db from '@db'
import * as Table from '@db/schema'

import FS from 'fs'

import z, { ZodError } from 'zod'
import { aliasedTable, DrizzleError, eq } from 'drizzle-orm'
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
    images: true,
    creator: true,
    createdAt: true,
    updatedAt: true,
})
export type UpdateItemType = z.infer<typeof UpdateItemSchema>

const router = Router()
router.use(authMiddleware)

// ---> Query Endpoints <--- //
// Query Modeles
router.get('/models', async (req: Request, res: Response) => {
    const QueryParams = z.object({
        limit: z.number().int().max(50).default(20),
        nsfw: z.boolean().default(false),
        type: z.array(z.enum(Table.ESDItemType.enumValues)).default([]),
    })
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse(req.params)

    const entries = await db
        .select()
        .from(Table.SDBaseItem)
        .innerJoin(Table.User, eq(Table.User.id, Table.SDBaseItem.creatorId))
        .innerJoin(
            Table.SDContainer,
            eq(Table.SDContainer.id, Table.SDBaseItem.containerId)
        )
        .innerJoin(Table.Image, eq(Table.Image.baseItemId, Table.SDBaseItem.id))

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

        data[data.length - 1].images.push(RefImageSceham.parse(e.Image))
    }

    FS.writeFileSync('./test/data.json', JSON.stringify(entries, null, 4))

    res.json({ data, meta: {} })
})

// Query Contaienrs
router.get('/containers', async (req: Request, res: Response) => {
    const QueryParams = z.object({
        limit: z.number().int().max(50).default(20),
        nsfw: z.boolean().default(false),
        type: z.array(z.enum(Table.ESDItemType.enumValues)).default([]),
    })
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse(req.params)

    const entries = await db
        .select()
        .from(Table.SDContainer)
        .innerJoin(Table.User, eq(Table.User.id, Table.SDContainer.creatorId))
        .innerJoin(
            Table.SDBaseItem,
            eq(Table.SDBaseItem.containerId, Table.SDContainer.id)
        )

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
        data[data.length - 1].items.push(RefItemSchema.parse(e.SDBaseItem))
    }

    res.json({ data, meta: {} })
})

// Get specific container
router.get('/containers/:cID', async (req: Request, res: Response) => {
    const user = req.user

    const QueryParams = z.object({
        cID: z.string(),
    })
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse(req.params)

    const entries = await db
        .select()
        .from(Table.SDContainer)
        .innerJoin(
            Table.SDBaseItem,
            eq(Table.SDContainer.id, Table.SDBaseItem.containerId)
        )
        .innerJoin(Table.User, eq(Table.SDContainer.creatorId, Table.User.id))
        .where(eq(Table.SDContainer.id, query.cID))

    FS.writeFileSync('test/data.json', JSON.stringify(entries, null, 4))

    let data: ContainerType = ContainerSchema.parse({
        ...entries[0].SDContainer,
        creator: entries[0].User,
        items: [],
    })
    for (let e of entries) {
        data.items.push(RefItemSchema.parse(e.SDBaseItem))
    }

    res.json({ data, meta: {} })
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
        const query: QueryType = QueryParams.parse(req.params)

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
    const query: QueryType = QueryParams.parse(req.params)
    const user = req.user

    const entries = await db
        .select()
        .from(Table.SDBaseItem)
        .innerJoin(
            Table.SDContainer,
            eq(Table.SDContainer.id, Table.SDBaseItem.containerId)
        )
        .innerJoin(Table.Image, eq(Table.Image.baseItemId, Table.SDBaseItem.id))
        .innerJoin(Table.User, eq(Table.User.id, Table.SDBaseItem.creatorId))
        .where(eq(Table.SDBaseItem.id, query.mID))

    const data: ItemType = ItemSchema.parse({
        ...entries[0].SDBaseItem,
        creator: entries[0].User,
        container: entries[0].SDContainer,
        images: [],
    })

    for (let e of entries) {
        data.images.push(RefImageSceham.parse(e.Image))
    }

    res.status(200).json({ data, meta: {} })
})

// ---> Create Endpoints <--- //
// Create a new container
router.post('/containers', async (req: Request, res: Response) => {
    const user = req.user
})

// Delete a container if no models are assigned to it
router.delete('/containers/:cID', async (req: Request, res: Response) => {
    const user = req.user
})

// Create a new model
router.post('/models', async (req: Request, res: Response) => {
    const user = req.user
})

// Delete a model
router.delete('/models/:mID', async (req: Request, res: Response) => {
    const user = req.user
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
