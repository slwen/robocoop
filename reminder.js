import moment from 'moment'
import state, { setState } from './state'

let reminderInterval

/*
 * Sets an interval to remind everyone in channel to complete a set of the given exercise.
 * @param {object} A spawned bot instance that will do the reminding.
 * @param {string} Frequency for reminders to occur; 'hourly', 'half-hourly', 'daily', 'never'.
 * @param {object} A moment.js datetime object; When the challenge (and reminders) should end.
 */
export default function(bot, frequency, endDay) {
  const { setSize, exercise } = state
  const groupReminders = [
    `Everybody, do ${setSize} ${exercise}! Your move, creeps.`,
    `Dead or alive, everybody give me ${setSize} ${exercise}!`,
    `Everybody remember, ${setSize} ${exercise}, or there will be... trouble.`,
    `I'm reminding you all to complete ${setSize} ${exercise}. Thank you for your co-operation.`
  ]

  setState({ reminderFrequency: frequency })

  if (reminderInterval) clearInterval(reminderInterval)
  reminderInterval = setInterval(() => {
    if (frequency.toLowerCase() === 'never' || moment(endDay).isSameOrBefore(moment())) {
      clearInterval(reminderInterval)
      return
    }

    bot.say({
      text: groupReminders[Math.floor(Math.random() * groupReminders.length)],
      channel: state.channel
    })
  }, frequencyInMilliseconds(frequency))
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
