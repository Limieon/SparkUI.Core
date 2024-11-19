import { authMiddleware } from '$/service/Auth'
import { Router, Request, Response } from 'express'

import { UserSchema } from '$/routes/api/v1/user'

import * as Table from '@db/schema'

import z, { ZodError } from 'zod'
import db from '$/db'
import { eq } from 'drizzle-orm'

const router = Router()
router.use(authMiddleware)

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

router.get('', async (req: Request, res: Response) => {
    const QueryParams = z.object({})
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })

    const user = req.user
    if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
    }

    try {
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

        res.status(200).json({ data, meta: {} })
    } catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json({ error: e.message })
        }
        res.status(500).json({ error: e.message })
    }
})

router.get('/:id/raw.webp', async (req: Request, res: Response) => {
    const QueryParams = z.object({
        id: z.string().uuid(),
    })
    type QueryType = z.infer<typeof QueryParams>
    const query: QueryType = QueryParams.parse({ ...req.query, ...req.params })

    const user = req.user
    if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
    }

    try {
        const image = await db
            .select({ data: Table.Image.data })
            .from(Table.Image)
            .where(eq(Table.Image.id, query.id))
            .limit(1)

        if (image.length < 1) {
            res.status(404).json({ error: 'Image not found' })
            return
        }

        res.setHeader('Content-Type', 'image/webp')
        res.status(200).send(image[0].data)
    } catch (e) {
        if (e instanceof ZodError) {
            res.status(400).json({ error: e.message })
        }
        res.status(500).json({ error: e.message })
    }
})

export default router
