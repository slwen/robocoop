import { merge } from 'lodash'
import controller from './controller'

let state = {}

export function setState(newState = {}) {
  state = merge(state, newState)
  controller.storage.teams.save(state)
}

export default state
