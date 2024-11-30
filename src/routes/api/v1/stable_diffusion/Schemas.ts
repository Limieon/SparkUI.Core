import { z } from 'zod'
import { RefUserSchema } from '../user'
import * as ImageSchemas from '../image/Schemas'

import * as Table from '@db/schema'

export const RefItem = z.object({
	id: z.string().uuid(),
	name: z.string(),
	description: z.string(),
	brief: z.string(),
})
export type RefItemType = z.infer<typeof RefItem>
export const RefContainer = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	brief: z.string(),
})
export type RefContainerType = z.infer<typeof RefContainer>

export const Container = z.object({
	id: z.string().uuid(),

	name: z.string(),
	description: z.string(),
	brief: z.string(),

	creator: RefUserSchema,
	items: z.array(RefItem),

	createdAt: z.date(),
	updatedAt: z.date(),
})
export type ContainerType = z.infer<typeof Container>
export const UpdateContainer = Container.omit({
	id: true,
	items: true,
	creator: true,
	createdAt: true,
	updatedAt: true,
})
export type UpdateContainerType = z.infer<typeof UpdateContainer>

export const Item = z.object({
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

	container: RefContainer,
	creator: RefUserSchema,
	images: z.array(ImageSchemas.RefImage),

	createdAt: z.date(),
	updatedAt: z.date(),
	lastUsedAt: z.date().nullable(),
})
export type ItemType = z.infer<typeof Item>
export const UpdateItem = Item.omit({
	id: true,
	container: true,
	creator: true,
	images: true,
	createdAt: true,
	updatedAt: true,
	lastUsedAt: true,
})
export type UpdateItemType = z.infer<typeof UpdateItem>
