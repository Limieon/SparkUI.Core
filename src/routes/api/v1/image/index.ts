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
export const RefImageSceham = z.object({
    id: z.string().uuid(),
})
export type ImageType = z.infer<typeof ImageSchema>
export type RefImageType = z.infer<typeof RefImageSceham>

export default router
