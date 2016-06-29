import { sample } from 'lodash'
import moment from 'moment'
import state, { setState } from './state'
import { getUserSlackerboard } from './user'

let reminderInterval

/*
 * Sets an interval to remind everyone in channel to complete a set of the given exercise.
 * @param {object} A spawned bot instance that will do the reminding.
 * @param {string} Frequency for reminders to occur; 'hourly', 'half-hourly', 'daily', 'never'.
 * @param {object} A moment.js datetime object; When the challenge (and reminders) should end.
 */
export default function(bot, frequency, endDay) {
  setState({ reminderFrequency: frequency })

  if (reminderInterval) clearInterval(reminderInterval)

  reminderInterval = setInterval(() => {
    if (frequency.toLowerCase() === 'never' || moment(endDay).isSameOrBefore(moment())) {
      clearInterval(reminderInterval)
      return
    }

    remindTheGroup(bot)
    singleOutSlackers(bot)
  }, frequencyInMilliseconds(frequency))
}

/*
 * Send a random reminder message to the group.
 * @param {object} a bot instance to do the messaging.
 */
function remindTheGroup(bot) {
  const { setSize, exercise } = state
  const groupReminders = [
    `Everybody, do ${setSize} ${exercise}! Your move, creeps.`,
    `Dead or alive, everybody give me ${setSize} ${exercise}!`,
    `Everybody remember, ${setSize} ${exercise}, or there will be... trouble.`,
    `I'm reminding you all to complete ${setSize} ${exercise}. Thank you for your co-operation.`
  ]

  bot.say({
    text: groupReminders[Math.floor(Math.random() * groupReminders.length)],
    channel: state.channel
  })
}

/*
 * Single out people at the bottom of the leaderboard when at least 10 people are invloved.
 * @param {object} a bot instance to do the messaging.
 */
function singleOutSlackers(bot) {
  const slackers = getUserSlackerboard(3)

  if (slackers.length >= 10) {
    bot.say({
      text: `<@${sample(slackers).id}>, that includes you!`,
      channel: state.channel
    })
  }
}

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
      return moment.duration(5, 'seconds')
  }
}
