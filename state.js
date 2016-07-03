import { mergeWith, isArray } from 'lodash'
import controller from './controller'

let state = {}

export const initialState = {
  users: [],
  reps: 0,
  setSize: 0,
  exercise: '',
  endDay: '',
  reminderFrequency: 'never'
}

/*
 * Prepare for feeling dirty.
 * If we pass an empty array just straight up blow away all values.
 */
const customiser = (objValue, srcValue) => {
  if (isArray(srcValue) && srcValue.length === 0) {
    return objValue = srcValue
  }
}

export function setState(newState = null) {
  mergeWith(state, newState, customiser)
  if (state.id) controller.storage.teams.save(state)
}

export default state
