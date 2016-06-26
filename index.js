import { reduce, merge } from 'lodash'
import moment from 'moment'
import controller from './controller'
import state, { setState } from './state'
import setGroupReminder from './reminder'
import { logUserReps, findUserById, getTotalUserReps } from './user'

if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment')
  process.exit(1)
}

const robocoop = controller.spawn({
  token: process.env.TOKEN
}).startRTM()

const frequencyRegex = '^(hourly|half-hourly|daily|never|debug)$'

const initialState = {
  users: [],
  reps: 0,
  setSize: 0,
  exercise: '',
  endDay: '',
  reminderFrequency: 'never'
}

/*
 * Set the initial state upon connection by checking the store.
 * If there's nothing in the store then set an initial state.
 * Also start up reminder interval if a frequency is set.
 */
controller.on('hello', (bot, message) => {
  const defaultState = merge(initialState, {
    id: bot.team_info.id,
    team: bot.team_info.id
  })

  controller.storage.teams.get(bot.team_info.id, (err, storedData) => {
    if (err) {
      setState(defaultState)
      return
    }

    setState(storedData)
    setGroupReminder(bot, state.reminderFrequency, state.endDay)
  })
})

/*
 * Listens for a new challenge and asks the user to set a reminder frequency.
 */
controller.hears('new challenge (.*) (.*) by (.*) in sets of (.*)', ['direct_mention','mention'], (bot, message) => {
  const { user, channel } = message

  setState({
    reps: message.match[1],
    exercise: message.match[2],
    endDay: interpretedEndDate(message.match[3]),
    setSize: message.match[4],
    channel
  })

  bot.startConversation(message, (err, convo) => {
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
  })
})

/*
 * Listens to give current challenge status.
 */
controller.hears('status', ['direct_mention','mention'], (bot, message) => {
  const { users, exercise, reps, endDay } = state
  const { user } = message
  const totalToComplete = reps
  const remaining = getTotalRepsRemaining()
  const activeUserCount = users.length
  const daysRemaining = moment(endDay).diff(moment(), 'days') + 1
  const dailyAverage = (remaining / activeUserCount) / daysRemaining

  bot.reply(message, `<@${user}> you have done ${getTotalUserReps(user)} ${exercise}. *${activeUserCount} people* are actively particpating. If each of you continues to do *${dailyAverage} ${exercise} per day* you will complete your challenge on time by *${moment(endDay).format('dddd')}*.`)
})

/*
 * Listens to end the challenge, clears out current state and storage.
 */
controller.hears('end the challenge', ['direct_mention','mention'], (bot, message) => {
  setState(initialState)
  bot.reply(message, `Okay, I've ended the challenge. Stay out of trouble.`)
})

/*
 * Listens for users requesting a change in reminder frequency.
 */
controller.hears('remind (.*)', ['direct_mention','mention'], (bot, message) => {
  const frequency = message.match[1].toLowerCase()

  if (!state.exercise) {
    bot.reply(message, `I'd like to but, there isn't an active challenge right now...`)
    return
  }

  if (frequency.match(frequencyRegex)) {
    if (frequency === 'never') {
      bot.reply(message, `Got it. I'll cool it with the reminders for now.`)
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
controller.hears('I did (.*)', ['direct_mention','mention'], (bot, message) => {
  const newReps = parseInt(message.match[1])
  const { user } = message
  const { exercise, setSize } = state

  if (!exercise) {
    bot.reply(message, `There isn't an active challenge right now.`)
    return
  }

  if (isNaN(newReps)) {
    bot.reply(message, `I do not understand – I am just a bot after all.`)
    return
  }

  if (newReps === 0) {
    bot.reply(message, `Thank you, <@${user}>. I also did 0 ${exercise} just now.`)
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
  }
})

/*
 * Get the total remaining reps for the current challenge.
 */
function getTotalRepsRemaining() {
  return reduce(state.users, (sum, user) => {
    return sum - user.reps
  }, state.reps)
}

/*
 * Works out end date based on the day name, if todays name is used it assumes you mean next week.
 * @param {string} A day name for when the reminders should stop.
 */
function interpretedEndDate(dayName) {
  const todaysIndex = moment().day();
  const endDayIndex = moment().day(dayName).day();

  let result = moment()
    .day(dayName)
    .set('hour', 11)
    .set('minute', 59)

  if (endDayIndex === todaysIndex) {
    return result.add(7, 'days')
  }

  return result
}
