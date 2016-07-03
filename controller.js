import Botkit from 'botkit'
import redisStorage from 'botkit-storage-redis'

const redis = redisStorage()

export default Botkit.slackbot({
  storage: redis,
  debug: false
})
