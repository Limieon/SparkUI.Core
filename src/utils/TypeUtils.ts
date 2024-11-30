import * as Table from '@db/schema'

import { z } from 'zod'

export const ESDItemTypeSchema = z.enum(Table.ESDItemType.enumValues)
export type ESDItemType = z.infer<typeof ESDItemTypeSchema>

export const EModelPrecisionSchema = z.enum(Table.EModelPrecision.enumValues)
export type EModelPrecision = z.infer<typeof EModelPrecisionSchema>

export const EModelSizeType = z.enum(Table.EModelSizeType.enumValues)
export type EModelSizeType = z.infer<typeof EModelSizeType>
