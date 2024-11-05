import { authMiddleware } from '$/service/Auth'
import { Router, Request, Response } from 'express'

import { UserSchema } from '$/routes/api/v1/user'

import * as Table from '@db/schema'

import z from 'zod'

const router = Router()
router.use(authMiddleware)

export const ImageSchema = z.object({
    id: z.string().uuid(),
    blurHash: z.string(),
    createdAt: z.number(),
})
export type ImageType = z.infer<typeof ImageSchema>

export default router
