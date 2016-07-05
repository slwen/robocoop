import { sample, random } from 'lodash'
import moment from 'moment'
import state, { setState } from './state'
import { getUserSlackerboard } from './user'
import { challengeInPast } from './utilities'

let reminderInterval

/*
 * Sets an interval to remind everyone in channel to complete a set of the given exercise.
 * @param {object} A spawned bot instance that will do the reminding.
 * @param {string} Frequency for reminders to occur; 'hourly', 'half-hourly', 'daily', 'never'.
 * @param {object} A moment.js datetime object; When the challenge (and reminders) should end.
 */
export default function(bot, frequency = 'never', endDay) {
  setState({ reminderFrequency: frequency })

  if (reminderInterval) clearInterval(reminderInterval)

  reminderInterval = setInterval(() => {
    if (frequency.toLowerCase() === 'never' || challengeInPast(endDay)) {
      clearInterval(reminderInterval)
      return
    }

    // Don't do reminders on weekends or after hours
    const currentDay = moment().utcOffset("+10:00").day()
    const currentHour = moment().utcOffset("+10:00").hour()
    console.log(`Hour: ${currentHour}, Day: ${currentDay}, endDay: ${endDay}`)

    if (currentDay === 0 || currentDay === 6 || currentHour < 8 || currentHour > 20) {
      console.log(`Suppressing reminder...`)
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
    text: sample(groupReminders),
    channel: state.channel
  })
}

/*
 * Single out people at the bottom of the leaderboard when at least 8 people are invloved.
 * @param {object} a bot instance to do the messaging.
 */
function singleOutSlackers(bot) {
  const slackers = getUserSlackerboard(3)
  const dice = random(2)

  if (slackers.length >= 8 && dice > 1) {
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
function frequencyInMilliseconds(frequency = '') {
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
