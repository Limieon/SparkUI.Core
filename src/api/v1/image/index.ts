import { Router } from 'express'
import { jwtAuth } from '../../../Server'
import { db } from '../../../db/DB'

import FS from 'fs'
import Sharp from 'sharp'

export function appendImageURL(image: any) {
	if (!image) return image
	if (!image.id) return image
	image.url = `${process.env.SPARKUI_CORE_BASE_URL}/api/v1/image/${image.id}/full`
	return image
}

const router = Router()
router.use(jwtAuth)

router.get('/:imageId/full', async (req, res) => {
	const imageId = req.params.imageId
	const jwt = req.user

	const contentType: string = req.headers['content-type'] || 'image/webp'

	if (!imageId) return res.status(400).json({ message: 'Bad Request' })

	const image = await db.query.Image.findFirst({
		where: (i, { eq }) => eq(i.id, imageId),
	})
	if (!image) return res.status(404).json({ message: 'Image Not Found' })
	if (!image.data) {
		if (!image.file) return res.status(404).json({ message: 'Image Not Found' })
		image.data = FS.readFileSync(image.file)
	}

	if (contentType === 'image/webp') return res.setHeader('Content-Type', 'image/webp').send(image.data)
	const sharpInstance = Sharp(Buffer.from(image.data))

	if (contentType === 'image/png') return res.setHeader('Content-Type', 'image/png').send(await sharpInstance.png().toBuffer())
	if (contentType === 'image/jpeg') return res.setHeader('Content-Type', 'image/jpeg').send(await sharpInstance.jpeg().toBuffer())
	if (contentType === 'image/tiff') return res.setHeader('Content-Type', 'image/tiff').send(await sharpInstance.tiff().toBuffer())
	if (contentType === 'image/avif') return res.setHeader('Content-Type', 'image/avif').send(await sharpInstance.avif().toBuffer())
	if (contentType === 'image/gif') return res.setHeader('Content-Type', 'image/gif').send(await sharpInstance.gif().toBuffer())

	return res.status(400).json({ message: `Bad Request, Invalid Content-Type ${contentType}` })
})

export default router
