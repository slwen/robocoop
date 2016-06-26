if (!process.env.token) {
  console.log('Error: Specify token in environment')
  process.exit(1)
}

const _ = require('lodash')
const Botkit = require('botkit')
const moment = require('moment')

const controller = Botkit.slackbot({
  json_file_store: './store',
  debug: false
})

const robocoop = controller.spawn({
  token: process.env.token
}).startRTM()

const frequencyRegex = '^(hourly|half-hourly|daily|never)$'

/*
 * State. Behold, God's mistake.
 */
let state = {};

function setState(newState = {}) {
  state = Object.assign({}, state, newState)
  controller.storage.teams.save(state)
}

function getStoredState() {
  controller.storage.teams.get(state.id, (err, storedData) => {
    state = Object.assign({}, state, storedData)
  })

  return state
}

/*
 * Set the initial state upon connection
 */
controller.on('hello', (bot, message) => {
  setState({
    id: bot.team_info.id,
    users: [],
    reps: 0,
    setSize: 0,
    exercise: '',
    endDay: '',
    reminderInterval: null,
    team: bot.team_info.id
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

          remindGroup(response.text, state.endDay)
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
 * Listens to end the challenge, clears out current state and storage.
 */
controller.hears('end the challenge', ['direct_mention','mention'], (bot, message) => {
  setState(initialState)
  bot.reply(message, `Okay, I've ended the challenge. Stay out of trouble.`)
})

/*
 * Converts a user inputted string in to a millisecond duration.
 * @param {string} Frequency for reminders to occur; 'hourly', 'half-hourly', 'daily', 'never'.
 */
function frequencyInMilliseconds(frequency) {
  switch(frequency.toLowerCase()) {
    case 'hourly':
      return moment.duration(1, 'hours')
    case 'half-hourly':
      return moment.duration(0.5, 'hours')
    case 'daily':
      return moment.duration(1, 'days')
    default:
      return moment.duration(1, 'days')
  }
}

/*
 * Sets an interval to remind everyone in channel to complete a set of the given exercise.
 * @param {string} Frequency for reminders to occur; 'hourly', 'half-hourly', 'daily', 'never'.
 * @param {object} A moment.js datetime object; When the challenge (and reminders) should end.
 */
function remindGroup(frequency, endDay) {
  const { setSize, exercise, reminderInterval } = state
  const groupReminders = [
    `Everybody, do ${setSize} ${exercise}! Your move, creeps.`,
    `Dead or alive, everybody give me ${setSize} ${exercise}!`,
    `Everybody remember, ${setSize} ${exercise}, or there will be... trouble.`,
    `I'm reminding you all to complete ${setSize} ${exercise}. Thank you for your co-operation.`
  ]

  if (reminderInterval) clearInterval(reminderInterval)

  if (!frequency.toLowerCase === 'never' && endDay.isAfter(moment())) {
    setState({
      reminderInterval: setInterval(() => {
        robocoop.say({
          text: groupReminders[Math.floor(Math.random()*groupReminders.length)],
          channel: state.channel
        })
      }, frequencyInMilliseconds(frequency))
    })
  }
}

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
      remindGroup(frequency, state.endDay)
    }
  } else {
    bot.reply(message, `Sorry chum, I don't understand. You can change to *hourly*, *half-hourly* or *daily*.`)
  }
})

/*
 * Listen for the user asking to record some reps.
 */
controller.hears('I did (.*)', ['direct_mention','mention'], (bot, message) => {
  const newReps = parseInt(message.match[1])
  const user = { message }

  if (!state.exercise) {
    bot.reply(message, `There isn't an active challenge right now.`)
    return
  }

  if (isNaN(newReps)) {
    bot.reply(message, `I do not understand – I am just a bot after all.`)
  }

  logUserReps(user, newReps)

  bot.reply(message, `Thank you, <@${user}>. ${getTotalRepsRemaining()} squats remaining.`)
})

/*
 * Stores reps alongside a user.
 * @param {string} user id string.
 * @param {number} number of reps the user has completed.
 */
function logUserReps(userId, newReps = 0) {
  const existingReps = getTotalUserReps(userId)

  setState({
    users: [...state.users, { id: userId, reps: existingReps + newReps }]
  })
}

/*
 * Get the total recorded reps for a given user.
 * @param {string} user id string.
 */
function getTotalUserReps(userId) {
  return _.find(state.users, user => user.id === userId).reps || 0
}

/*
 * Get the total remaining reps for the current challenge.
 */
function getTotalRepsRemaining() {
  return _.reduce(state.users, (sum, user) => {
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
