import moment from 'moment'
import controller from './controller'
import state, { setState, initialState } from './state'
import setGroupReminder from './reminder'
import { logUserReps, findUserById, getTotalUserReps, getUserLeaderboard } from './user'
import { challengeInPast, interpretedEndDate, getTotalRepsRemaining } from './utilities'

if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment')
  process.exit(1)
}

const robocoop = controller.spawn({
  token: process.env.TOKEN
}).startRTM()

const frequencyRegex = '^(hourly|half-hourly|daily|never|debug)$'

controller.on('bot_channel_join', (bot, message) => {
  bot.reply(message, `I am Robocoop. Serve the swole. Protect the jacked. Uphold the gainz.`)
})

/*
 * If there's nothing in the store then set an initial state with team id.
 * Also kick off reminder interval if a frequency already is set.
 */
controller.on('hello', (bot, message) => {
  controller.storage.teams.get(bot.team_info.id, (err, storedData) => {
    if (err || !storedData || !storedData.id) {
      const initialStateWithId = Object.assign({}, initialState, {
        id: bot.team_info.id,
        team: bot.team_info.id
      })

      setState(initialStateWithId)
      return
    }

    setState(storedData)
    setGroupReminder(bot, state.reminderFrequency, state.endDay)
  })
})

/*
 * Listens for a new challenge and asks the user to set a reminder frequency.
 */
controller.hears('new challenge (.*) (.*) by (.*) in sets of (.*)', ['direct_mention', 'mention'], (bot, message) => {
  const { user, channel } = message

  const confirmNewChallenge = (response, convo) => {
    convo.ask(`Starting a new challenge will erase the existing one. Still want to go ahead <@${user}>?`, [
      {
        pattern: bot.utterances.yes,
        callback(response, convo) {
          startNewChallengeConvo(response, convo)
          convo.next()
        }
      },
      {
        pattern: bot.utterances.no,
        callback(response, convo) {
          convo.say(`Alright, I'll forget you asked.`);
          convo.next()
        }
      },
      {
        default: true,
        callback(response, convo) {
          convo.repeat()
          convo.next()
        }
      }
    ])
  }

  const startNewChallengeConvo = (response, convo) => {
    setState({
      users: [],
      reps: message.match[1],
      exercise: message.match[2],
      endDay: interpretedEndDate(message.match[3]),
      setSize: message.match[4],
      channel
    })

    convo.say(`Okay <@${user}>, ${state.reps} ${state.exercise} by ${state.endDay.format('dddd')} is the new challenge.`)
    convo.ask(`How often should I remind everybody about the challenge? *hourly*, *half-hourly* or *daily*?`, [
      {
        pattern: frequencyRegex,
        callback(response, convo) {
          if (response.text === 'never') {
            convo.say(`No problem.`)
          } else {
            convo.say(`Okay, I'll remind everybody to do a set of ${state.setSize} ${response.text}.`)
          }

          setGroupReminder(robocoop, response.text, state.endDay)
          convo.next()
        }
      },
      {
        default: true,
        callback(response, convo) {
          convo.repeat()
          convo.next()
        }
      }
    ])
  }

  if (state.exercise) {
    bot.startConversation(message, confirmNewChallenge)
  } else {
    bot.startConversation(message, startNewChallengeConvo)
  }
})

/*
 * Listens to give current challenge status.
 */
controller.hears('status', ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  const { users, exercise, reps, endDay } = state
  const { user } = message
  const totalToComplete = reps
  const remaining = getTotalRepsRemaining()
  const activeUserCount = users.length
  const daysRemaining = moment(endDay).diff(moment(), 'days') + 1
  const dailyAverage = Math.ceil((remaining / activeUserCount) / daysRemaining)

  if (challengeInPast(endDay)) {
    bot.reply(message, `<@${user}> the challenge has ended. You did ${getTotalUserReps(user)} ${exercise}.`)
    return
  }

  if (!exercise) {
    bot.reply(message, `There's no challenge set at the moment.`)
    return
  }

  if (remaining === totalToComplete) {
    bot.reply(message, `No one has done anything yet... :broken_heart:`)
    return
  }

  bot.reply(message, `<@${user}> you have done ${getTotalUserReps(user)} ${exercise}. *${activeUserCount} people* are actively particpating. If each of you continues to do *${dailyAverage} ${exercise} per day* you will complete your challenge on time by *${moment(endDay).format('dddd')}*.`)
})

/*
 * Listens to give a top 5 leaderboard
 */
controller.hears('leaderboard', ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  const leaderboardMessage = getUserLeaderboard(5)
    .map((leader, i) => `> ${i+1}. <@${leader.id}> (${leader.reps})`)
    .join(`\n`)

  if (!leaderboardMessage) {
    bot.reply(message, `No one has done anything yet... :broken_heart:`)
    return
  }

  bot.reply(message, {
    text: leaderboardMessage,
    mrkdwn: true
  })
})

/*
 * Listens to end the challenge, clears out current state and storage.
 */
controller.hears('end the challenge', ['direct_mention', 'mention'], (bot, message) => {
  if (!state.exercise) {
    bot.reply(message, `There's no challenge set at the moment.`)
    return
  }

  bot.startConversation(message, (err, convo) => {
    convo.ask(`You sure, <@${message.user}>?`, [
      {
        pattern: bot.utterances.yes,
        callback(response, convo) {
          convo.say(`Okay, I've ended the challenge. Stay out of trouble.`);
          setState(initialState)
          convo.next()
        }
      },
      {
        pattern: bot.utterances.no,
        callback(response, convo) {
          convo.say(`Alright, I'll forget you asked.`);
          convo.next()
        }
      },
      {
        default: true,
        callback(response, convo) {
          convo.repeat()
          convo.next()
        }
      }
    ])
  })
})

/*
 * Listens for users requesting a change in reminder frequency.
 */
controller.hears('remind (.*)', ['direct_mention', 'mention'], (bot, message) => {
  const frequency = message.match[1].toLowerCase()

  if (!state.exercise) {
    bot.reply(message, `I'd like to but, there isn't an active challenge right now...`)
    return
  }

  if (frequency.match(frequencyRegex)) {
    if (frequency === 'never') {
      bot.reply(message, `Got it. I'll cool it with the reminders for now. :thumbsup:`)
    } else {
      bot.reply(message, `Okay, I'll remind everybody to do a set of ${state.setSize} ${frequency}.`)
    }

    setGroupReminder(robocoop, frequency, state.endDay)
  } else {
    bot.reply(message, `Sorry chum, I don't understand. You can change to *hourly*, *half-hourly* or *daily*.`)
  }
})

/*
 * Listen for the user asking to record some reps.
 */
controller.hears(['I did (.*)', `I've done (.*)`], ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  const newReps = parseInt(message.match[1])
  const { user } = message
  const { exercise, setSize, endDay } = state

  if (challengeInPast(endDay)) {
    bot.reply(message, `<@${user}> the challenge has ended.`)
    return
  }

  if (!exercise) {
    bot.reply(message, `There isn't an active challenge right now.`)
    return
  }

  if (newReps === 0) {
    bot.reply(message, `Thank you, <@${user}>. I also did 0 ${exercise} just now.`)
    return
  }

  if (newReps >= 500) {
    bot.reply(message, {
      'attachments': [
        {
          text: 'Sure buddy, not falling for that one again...',
          image_url: 'http://i.imgur.com/seh6p.gif'
        }
      ],
    })
    return
  }

  if (newReps > 0 && newReps < setSize) {
    bot.reply(message, `Sorry <@${user}>, ${exercise} must be completed in sets of ${setSize}. If you need help counting try asking a friend.`)
    return
  }

  if (newReps < 0) {
    bot.reply(message, `Did it hurt?`)
    return
  }

  if (newReps >= setSize && newReps % setSize !== 0) {
    const repsRoundedToNearestSet = newReps - (newReps % setSize)
    logUserReps(user, repsRoundedToNearestSet)
    bot.reply(message, `Thank you, <@${user}> but, ${exercise} must be completed in sets of ${setSize}. I counted ${repsRoundedToNearestSet} towards the total and ignored the remainder. ${getTotalRepsRemaining()} ${exercise} remaining.`)
    return
  }

  if (newReps >= setSize && newReps % setSize === 0) {
    logUserReps(user, newReps)
    bot.reply(message, `Thank you, <@${user}>. ${getTotalRepsRemaining()} ${exercise} remaining.`)
    return
  }

  bot.reply(message, `I do not understand...`)
})

/*
 * Listen for the user asking to undo some reps.
 */
controller.hears(`Undo (.*)`, ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  const undoReps = parseInt(message.match[1])
  const { user } = message
  const { exercise, setSize, endDay } = state
  const userReps = getTotalUserReps(user)

  if (challengeInPast(endDay)) {
    bot.reply(message, `<@${user}> the challenge has ended.`)
    return
  }

  if (!exercise) {
    bot.reply(message, `There isn't an active challenge right now.`)
    return
  }

  if (userReps <= 0 || userReps < undoReps) {
    bot.reply(message, `You've only completed ${userReps} ${exercise}. Don't sass me.`)
    return
  }

  if (undoReps > 0 && undoReps < setSize) {
    bot.reply(message, `Sorry, ${exercise} can only be undone in multiples of ${setSize}.`)
    return
  }

  if (undoReps < 0) {
    bot.reply(message, {
      'attachments': [
        {
          text: '...',
          image_url: 'https://media.giphy.com/media/NbgeJftsErO5q/giphy.gif'
        }
      ],
    })
    return
  }

  if (undoReps >= setSize && undoReps % setSize !== 0) {
    const repsRoundedToNearestSet = undoReps - (undoReps % setSize)
    logUserReps(user, -repsRoundedToNearestSet)
    bot.reply(message, `Since ${exercise} must be completed in sets of ${setSize} I removed ${repsRoundedToNearestSet} from the total and ignored the remainder. ${getTotalRepsRemaining()} ${exercise} remaining.`)
    return
  }

  if (undoReps >= setSize && undoReps % setSize === 0) {
    logUserReps(user, -undoReps)
    bot.reply(message, `I always knew you lied about those reps <@${user}>... Anyway, ${getTotalRepsRemaining()} ${exercise} remaining.`)
    return
  }

  bot.reply(message, `I do not understand...`)
})

controller.hears('help', ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  const commands = `
    - new challenge *[amount]* *[exercise]* by *[day]* in sets of *[reps]*
    - end the challenge
    - remind *[daily/hourly/half-hourly/never]*
    - I did *[amount]*
    - Undo *[amount]*
    - leaderboard
    - status
    - help
  `

  bot.reply(message, `Here are the commands I listen for: ${commands}`)
})
