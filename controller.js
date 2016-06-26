import Botkit from 'botkit'

export default Botkit.slackbot({
  json_file_store: './store',
  debug: false
})
