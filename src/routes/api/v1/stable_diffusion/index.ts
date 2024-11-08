import { authMiddleware } from '$/service/Auth'
import e, { Router, Request, Response } from 'express'

import { UserSchema } from '$/routes/api/v1/user'
import { ImageSchema, ImageType } from '$/routes/api/v1/image'

import db from '@db'
import * as Table from '@db/schema'

import FS from 'fs'

import z, { ZodError } from 'zod'
import { aliasedTable, DrizzleError, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import Logger from '@log'

export const ContainerSchema = z.object({
    id: z.string().uuid(),

    name: z.string(),
    description: z.string(),
    brief: z.string(),

    creator: UserSchema,
})
export type ContainerType = z.infer<typeof ContainerSchema>
const ContaienrUpdateSchema = ContainerSchema.omit({
    id: true,
    creator: true,
})

export const ItemSchema = z.object({
    id: z.string().uuid(),

    type: z.enum(Table.ESDItemType.enumValues),
    name: z.string(),
    description: z.string(),
    brief: z.string(),
    version: z.string(),
    usedInBatches: z.number().int(),
    usedInImages: z.number().int(),
    nsfw: z.boolean(),
    nsfwLevel: z.number().int(),
    trainingType: z.enum(Table.ESDTrainingType.enumValues),

    creator: UserSchema,
    container: ContainerSchema.optional(),
})
export type ItemType = z.infer<typeof ItemSchema>

const ItemUpdateSchema = ItemSchema.omit({
    id: true,
    usedInBatches: true,
    usedInImages: true,
    container: true,
    creator: true,
})

export const ContainerESchema = ContainerSchema.merge(
    z.object({
        items: z.array(ItemSchema),
    })
)
export type ContainerEType = z.infer<typeof ContainerESchema>

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

    const data: ItemType[] = []
    for (let d of await db
        .select()
        .from(Table.SDBaseItem)
        .innerJoin(Table.User, eq(Table.User.id, Table.SDBaseItem.creatorId))) {
        data.push(
            ItemSchema.parse({
                ...d.SDBaseItem,
                creator: { id: d.User?.id, name: d.User.name },
            })
        )
    }
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

    const data: ContainerType[] = []
    for (let d of await db
        .select()
        .from(Table.SDContainer)
        .innerJoin(
            Table.User,
            eq(Table.User.id, Table.SDContainer.creatorId)
        )) {
        data.push(
            ContainerSchema.parse({
                ...d.SDContainer,
                creator: { id: d.User.id, name: d.User.name },
            })
        )
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

    const queryRes = await db
        .select()
        .from(Table.SDContainer)
        .innerJoin(
            Table.SDBaseItem,
            eq(Table.SDContainer.id, Table.SDBaseItem.containerId)
        )
        .innerJoin(Table.User, eq(Table.SDContainer.creatorId, Table.User.id))
        .where(eq(Table.SDContainer.id, query.cID))
        .limit(1)

    const items: ItemType[] = []
    for (let d of queryRes) {
        items.push(
            ItemSchema.parse({
                ...d.SDBaseItem,
                creator: (
                    await db
                        .select()
                        .from(Table.User)
                        .where(eq(Table.User.id, d.SDBaseItem.creatorId))
                        .limit(1)
                )[0],
            })
        )
    }

    const data: ContainerEType = ContainerESchema.parse({
        items,
        creator: {
            id: queryRes[0].User.id,
            name: queryRes[0].User.name,
        },
        ...queryRes[0].SDContainer,
    })

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

    const ResSchema = z.object({
        id: z.string().uuid(),
        type: z.enum(Table.SDBaseItem.type.enumValues),
        description: z.string(),
        brief: z.string(),
        version: z.string(),
        usedInBatches: z.number().int(),
        usedInImages: z.number().int(),
        nsfw: z.boolean(),
        nsfwLevel: z.number().int(),
        trainingType: z.enum(Table.SDBaseItem.trainingType.enumValues),

        createdAt: z.date(),
        updatedAt: z.date(),
        lastUsedAt: z.date().nullable(),

        container: z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string(),
            brief: z.string(),
        }),
        creator: z.object({
            id: z.string().uuid(),
            name: z.string(),
        }),
    })

    try {
        const items = await db
            .select()
            .from(Table.SDBaseItem)
            .innerJoin(
                Table.SDContainer,
                eq(Table.SDContainer.id, Table.SDBaseItem.containerId)
            )
            .innerJoin(
                Table.User,
                eq(Table.User.id, Table.SDBaseItem.creatorId)
            )
            .where(eq(Table.SDBaseItem.id, query.mID))
            .limit(1)

        if (items.length < 1) {
            res.status(404).json({ error: 'No model found!' })
            return
        }

        const item = items[0]
        const data = ResSchema.parse({
            ...item.SDBaseItem,
            container: item.SDContainer,
            creator: item.User,
        })

        res.json({ data: ResSchema.parse(data), metadata: {} })
    } catch (e) {
        if (e instanceof ZodError) {
            res.status(500).send({ error: JSON.parse(e.message) })
        } else if (e instanceof Error) {
            res.status(500).send({ error: e.message })
        }
        Logger.error(e)
    }
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
