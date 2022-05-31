import debug from 'debug'

import yargsParser from 'yargs-parser'

const log = debug('@sequencemedia/rabbit-mq:argv')

log('`@sequencemedia/rabbit-mq:argv` is awake')

const {
  argv = []
} = process

export default new Map(Object.entries(yargsParser(argv.slice(2))))
