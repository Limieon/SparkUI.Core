import { z } from 'zod'

export const User = z.object({
	id: z.string().uuid(),
	name: z.string(),
})
export type UserType = z.infer<typeof User>
export const RefUser = z.object({
	id: z.string().uuid(),
	name: z.string(),
})
export type RefUserType = z.infer<typeof RefUser>
