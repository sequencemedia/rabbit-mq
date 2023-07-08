const debug = require('debug')

const MAP = require('./argv.cjs')

const log = debug('@sequencemedia/rabbit-mq:args')

log('`@sequencemedia/rabbit-mq:args` is awake')

module.exports = function connections (map = MAP) {
  return (
    map.has('connections') &&
    String(map.get('connections')) === 'true'
  )
}
