import debug from 'debug'

import MAP from './argv.mjs'

const log = debug('@sequencemedia/rabbit-mq:args')

log('`@sequencemedia/rabbit-mq:args` is awake')

export default function connections (map = MAP) {
  return (
    map.has('connections') &&
    String(map.get('connections')) === 'true'
  )
}
