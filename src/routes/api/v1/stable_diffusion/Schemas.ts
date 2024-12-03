import { z } from 'zod'
import * as UserSchemas from '../user/Schemas'
import * as ImageSchemas from '../image/Schemas'

import * as Table from '@db/schema'

import Path from 'path'

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

	creator: UserSchemas.RefUser,
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

export const ModelFile = z.object({
	id: z.string().uuid(),
	name: z.string().transform((v) => Path.basename(v)),
	sha1: z.string(),
	sha256: z.string(),
	modelHash: z.string(),
	sizeMB: z.number(),
	format: z.string().optional().nullable(),
	precision: z.string(),

	uploader: UserSchemas.RefUser,

	createdAt: z.string().transform((v) => new Date(v)),
})
export type ModelFileType = z.infer<typeof ModelFile>

export const Item = z.object({
	id: z.string().uuid(),

	type: z.enum(Table.SDBaseItem.type.enumValues),
	name: z.string(),
	description: z.string(),
	brief: z.string(),
	version: z.string(),
	usedInBatches: z.number().int().optional(),
	usedInImages: z.number().int().optional(),
	nsfw: z.boolean(),
	nsfwLevel: z.number().int(),
	trainingType: z.enum(Table.SDBaseItem.trainingType.enumValues),

	container: RefContainer,
	creator: UserSchemas.RefUser,
	images: z.array(ImageSchemas.RefImage),
	files: z.array(ModelFile),

	createdAt: z.date(),
	updatedAt: z.date(),
	lastUsedAt: z.date().nullable(),
})
export type ItemType = z.infer<typeof Item>

export const CheckpointItem = Item.merge(
	z.object({
		refiner: z.boolean(),
	})
)

export const LoraItem = Item.merge(
	z.object({
		triggerWords: z.array(z.string()),
	})
)
export type LoraItemType = z.infer<typeof LoraItem>

export const EmbeddingItem = Item.merge(
	z.object({
		triggerWords: z.array(z.string()),
	})
)
export type EmbeddingItemType = z.infer<typeof EmbeddingItem>

export const VAEItem = Item.merge(z.object({}))
export type VAEItemType = z.infer<typeof VAEItem>

export const ControlNetItem = Item.merge(z.object({}))
export type ControlNetItemType = z.infer<typeof ControlNetItem>

export const ControlNetPreprocessorItem = Item.merge(z.object({}))
export type ControlNetPreprocessorItemType = z.infer<typeof ControlNetPreprocessorItem>

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

export const UpdateCheckpointItem = CheckpointItem.omit({
	id: true,
	container: true,
	creator: true,
	images: true,
	createdAt: true,
	updatedAt: true,
	lastUsedAt: true,
})
export type UpdateCheckpointItemType = z.infer<typeof UpdateCheckpointItem>

export const UpdateLoraItem = LoraItem.omit({
	id: true,
	container: true,
	creator: true,
	images: true,
	createdAt: true,
	updatedAt: true,
	lastUsedAt: true,
})
export type UpdateLoraItemType = z.infer<typeof UpdateLoraItem>

export const UpdateEmbeddingItem = EmbeddingItem.omit({
	id: true,
	container: true,
	creator: true,
	images: true,
	createdAt: true,
	updatedAt: true,
	lastUsedAt: true,
})
export type UpdateEmbeddingItemType = z.infer<typeof UpdateEmbeddingItem>

export const UpdateVAEItem = VAEItem.omit({
	id: true,
	container: true,
	creator: true,
	images: true,
	createdAt: true,
	updatedAt: true,
	lastUsedAt: true,
})
export type UpdateVAEItemType = z.infer<typeof UpdateVAEItem>

export const UpdateControlNetItem = ControlNetItem.omit({
	id: true,
	container: true,
	creator: true,
	images: true,
	createdAt: true,
	updatedAt: true,
	lastUsedAt: true,
})
export type UpdateControlNetItemType = z.infer<typeof UpdateControlNetItem>

export const UpdateControlNetPreprocessorItem = ControlNetPreprocessorItem.omit({
	id: true,
	container: true,
	creator: true,
	images: true,
	createdAt: true,
	updatedAt: true,
	lastUsedAt: true,
})
export type UpdateControlNetPreprocessorItemType = z.infer<typeof UpdateControlNetPreprocessorItem>
