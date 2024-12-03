import { drizzle } from 'drizzle-orm/postgres-js'

import * as Env from '@env'
import * as schema from '@db/schema'
import { AnyColumn, AnyTable, DrizzleError, InferColumnsDataTypes, SQL, sql } from 'drizzle-orm'

const db = drizzle(Env.SPARKUI_CORE_DB_URL, { schema })
export default db

export function jsonAggBuildObject<T extends Record<string, AnyColumn>>(shape: T) {
	const shapeString = Object.entries(shape)
		.map(([key, value]) => {
			return `'${key}', ${value}`
		})
		.join(',')

	return sql<InferColumnsDataTypes<T>[]>`JSON_AGG(JSON_BUILD_OBJECT(${shapeString}))`
}

export function coalesce<T>(s: SQL, defaultValue: T) {
	return sql`COALESCE(${s}, ${defaultValue})`
}

export function jsonAgg(obj: SQL, filter: SQL) {
	return sql`JSON_AGG(${obj}) ${filter}`
}

/**
 * Build objects using `json_build_object(k1, v1, ...kn, vn).
 *
 * ⚠️ Vulnerable to SQL injections if used with user-input ⚠️
 */
export function jsonBuildObject<T extends Record<string, AnyColumn>>(shape: T) {
	const chunks: SQL[] = []
	Object.entries(shape).forEach(([key, value]) => {
		if (chunks.length > 0) {
			chunks.push(sql.raw(`,`))
		}
		chunks.push(sql.raw(`'${key}',`))
		chunks.push(sql`${value}`)
	})
	return sql<InferColumnsDataTypes<T>>`JSON_BUILD_OBJECT(${sql.join(chunks)})`
}

type InferColumnDataType<T extends AnyColumn> = T['_']['notNull'] extends true ? T['_']['data'] : T['_']['data'] | null

/**
 * Build object using `json_object_agg`.
 */
export function jsonObjectAgg<
	K extends AnyColumn,
	V extends AnyTable | Record<string, AnyColumn>,
	TK extends string | number = null extends InferColumnDataType<K>
		? never
		: InferColumnDataType<K> extends string | number
		? InferColumnDataType<K>
		: never,
	TV = V extends AnyTable ? InferSelectModel<V> : V extends Record<string, AnyColumn> ? InferColumnsDataTypes<V> : never
>(key: K, value: V) {
	const v = value instanceof Table ? value : jsonBuildObject(value).getSQL()
	return sql<Record<TK, TV>>`json_object_agg(${key}, ${v})`
}
