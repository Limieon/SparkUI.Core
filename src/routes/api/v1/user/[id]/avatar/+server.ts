import { json } from '@sveltejs/kit';

import { db } from '$lib/server/db';
import * as Table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

import Sharp from 'sharp';

export async function GET({ setHeaders, params }) {
	const id = params.id;
	const { avatar } = (
		await db
			.select({ avatar: Table.User.profilePicture })
			.from(Table.User)
			.where(eq(Table.User.id, id))
	)[0];

	if (!avatar) {
		const image = await Sharp(Buffer.alloc(1), {
			create: {
				width: 512,
				height: 512,
				channels: 4,
				background: { r: 255, g: 0, b: 255, alpha: 1 }
			}
		})
			.webp()
			.toBuffer();
		setHeaders({
			'Content-Type': 'image/webp',
			'Content-Length': `${image.length}`
		});

		return new Response(image);
	}
}
