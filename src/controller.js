import Botkit from 'botkit'
import redisStorage from 'botkit-storage-redis'

const redis = redisStorage({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
})

export default Botkit.slackbot({
  storage: redis,
  debug: false
})
