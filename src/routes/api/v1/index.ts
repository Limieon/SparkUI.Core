import { authMiddleware } from '$/service/Auth'
import { Router, Request, Response } from 'express'

const router = Router()
router.use(authMiddleware)

router.get('/status', async (req: Request, res: Response) => {
	res.send({ user: req.user })
})

export default router
