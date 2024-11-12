export interface CursorTuple {
	id: string
	createdAt: Date
}

export function encodeCursor(cursor: CursorTuple): string {
	return Buffer.from(JSON.stringify({ id: cursor.id, createdAt: cursor.createdAt.toISOString() })).toString('base64')
}
export function decodeCursor(cursor: string): CursorTuple {
	const data = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
	return { id: data.id, createdAt: new Date(data.createdAt) }
}
