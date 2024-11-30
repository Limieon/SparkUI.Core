import { z } from 'zod'

export const Image = z.object({
	id: z.string().uuid(),
	blurHash: z.string(),
	createdAt: z.number(),
})
export const RefImage = z.object({
	id: z.string().uuid(),
})
export type ImageType = z.infer<typeof Image>
export type RefImageType = z.infer<typeof RefImage>
