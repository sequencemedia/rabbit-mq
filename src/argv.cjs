const debug = require('debug')

const yargsParser = require('yargs-parser')

const log = debug('@sequencemedia/rabbit-mq:argv')

log('`@sequencemedia/rabbit-mq:argv` is awake')

const {
  argv = []
} = process

module.exports = new Map(Object.entries(yargsParser(argv.slice(2))))
