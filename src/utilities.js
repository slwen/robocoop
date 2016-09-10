import { reduce } from 'lodash'
import moment from 'moment'
import state from './state'

/*
 * Returns true/false for if the challenge is in the past.
 * @param {string} A date for when the challenge is ended.
 */
export const challengeInPast = endDay => moment(endDay).isSameOrBefore(moment())

/*
 * Works out end date based on the day name, if todays name is used it assumes you mean next week.
 * @param {string} A day name for when the reminders should stop.
 */
export const interpretedEndDate = dayName => {
  const todaysIndex = moment().day();
  const endDayIndex = moment().day(dayName).day();

  let result = moment()
    .day(dayName)
    .set('hour', 11)
    .set('minute', 59)

  if (endDayIndex <= todaysIndex) {
    return result.add(7, 'days')
  }

  return result
}

/*
 * Get the total remaining reps for the current challenge.
 */
export const getTotalRepsRemaining = () => {
  return reduce(state.users, (sum, user) => {
    return sum - user.reps
  }, state.reps)
}

/*
 * Get the total completed reps for the current challenge.
 */
export const getTotalRepsCompleted = () => {
  return reduce(state.users, (sum, user) => {
    return sum + user.reps
  }, 0)
}
