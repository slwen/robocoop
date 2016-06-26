import { find, union } from 'lodash'
import state, { setState } from './state'

/*
 * Stores reps alongside a user.
 * @param {string} user id string.
 * @param {number} number of reps the user has completed.
 */
export function logUserReps(userId, newReps = 0) {
  const existingReps = getTotalUserReps(userId)
  let user = findUserById(userId)

  if (user) {
    user.reps += newReps
  } else {
    user = { id: userId, reps: existingReps + newReps }
  }

  setState({
    users: union(state.users, [user])
  })
}

/*
 * Find a single user.
 * @param {string} user id string.
 */
export function findUserById(userId) {
  return find(state.users, user => user.id === userId)
}

/*
 * Get the total recorded reps for a given user.
 * @param {string} user id string.
 */
export function getTotalUserReps(userId) {
  const user = findUserById(userId)
  return (user && user.reps) || 0
}
