import { Hono } from 'hono'

const router = new Hono()
router.get('/status', (c) => {
    return c.text('Success!')
})

export default router
