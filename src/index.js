import debug from 'debug'

import amqp from 'amqplib'

const log = debug('@sequencemedia/rabbit-mq')
const info = debug('@sequencemedia/rabbit-mq:.')

log('`@sequencemedia/rabbit-mq` is awake')

const CLOSE = 60 * 1000

let CONNECTION = null

const CONNECTIONS = new Map()

export const getUsername = ({ username = 'guest' }) => username

export const getPassword = ({ password = 'guest' }) => password

export const getHostname = ({ hostname = 'localhost' }) => hostname

export const getPort = ({ port = 5672 }) => port

export const getVirtualHost = ({ virtualHost = '' }) => virtualHost

export const getExchange = ({ exchange }) => exchange

export const getQueue = ({ queueName }) => queueName

export const getRoutingKey = ({ routingKey }) => routingKey

export const toJson = (value) => (
  JSON.stringify(value)
)

export const fromJson = (value) => (
  JSON.parse(value)
)

export const toBuffer = (string) => (
  Buffer.from(string, 'utf8')
)

export const toString = (buffer) => (
  buffer.toString('utf8')
)

export function getFields ({ fields }) {
  log('getFields')

  if (fields) return fields
}

export function getProperties ({ properties }) {
  log('getProperties')

  if (properties) return properties
}

export function getContent ({ content }) {
  log('getContent')

  if (content) return content
}

export function encode (content) {
  log('encode')

  return toBuffer(toJson(content))
}

export function decode (content) {
  log('decode')

  return fromJson(toString(content))
}

export function transform (params) {
  log('transform')

  const username = getUsername(params)
  const password = getPassword(params)
  const hostname = getHostname(params)
  const port = getPort(params)
  const virtualHost = getVirtualHost(params)

  return `amqp://${username}:${password}@${hostname}:${port}/${virtualHost}`
}

export async function amqpConnect (params) {
  log('amqpConnect')

  const connection = CONNECTION || (CONNECTION = await amqp.connect(transform(params)))

  return {
    ...params,
    connection
  }
}

export async function amqpDisconnect ({ connection, ...params }) {
  log('amqpDisconnect')

  if (CONNECTIONS.has(connection)) clearTimeout(CONNECTIONS.get(connection))

  CONNECTIONS.set(connection, setTimeout(async function timeout () {
    log('timeout')

    try {
      if (connection === CONNECTION) CONNECTION = null

      CONNECTIONS.delete(connection)

      await connection.close()
    } catch (e) {
      handleCloseError(e)
    }
  }, CLOSE))

  return {
    ...params,
    connection
  }
}

export async function connectionCreateChannel ({ connection, ...params }) {
  log('connectionCreateChannel')

  const channel = await connection.createChannel()

  return {
    ...params,
    connection,
    channel
  }
}

export async function channelAssertExchange ({ channel, ...params }) {
  log('channelAssertExchange')

  const EXCHANGE = getExchange(params)

  const {
    exchange
  } = await channel.assertExchange(EXCHANGE, 'topic', { durable: true })

  info(EXCHANGE, exchange)

  return {
    ...params,
    channel,
    exchange
  }
}

export async function channelAssertQueue ({ channel, ...params }) {
  log('channelAssertQueue')

  const QUEUE = getQueue(params)

  const {
    queue
  } = await channel.assertQueue(QUEUE, { durable: true })

  info(QUEUE, queue)

  return {
    ...params,
    channel,
    queue
  }
}

export async function channelBindQueue ({ channel, queue, exchange, ...params }) {
  log('channelBindQueue')

  const ROUTINGKEY = getRoutingKey(params)

  await channel.bindQueue(queue, exchange, ROUTINGKEY)

  info(queue, exchange, ROUTINGKEY)

  return {
    ...params,
    channel,
    queue,
    exchange
  }
}

export async function channelPublish ({ channel, exchange, ...params }) {
  log('channelPublish')

  const ROUTINGKEY = getRoutingKey(params)
  const CONTENT = getContent(params)

  channel.publish(exchange, ROUTINGKEY, encode(CONTENT)) // returns boolean

  info(exchange, ROUTINGKEY)

  return {
    ...params,
    channel,
    exchange
  }
}

export async function channelQueue ({ channel, queue, ...params }) {
  log('channelQueue')

  const CONTENT = getContent(params)

  channel.sendToQueue(queue, encode(CONTENT)) // returns boolean

  info(queue)

  return {
    ...params,
    queue
  }
}

export async function channelConsume ({ channel, queue, handler, ...params }) {
  log('channelConsume')

  await channel.consume(queue, async function consumer (message) {
    info('consumer')

    channel.ack(message)

    const CONTENT = getContent(message)

    return (
      handler({ ...message, content: decode(CONTENT) })
    )
  })

  info(queue)

  return {
    ...params,
    channel,
    queue
  }
}

const getErrorMessage = ({ message = 'No error message defined' }) => message

function handleCloseError (e) {
  info(`Close failed with message "${getErrorMessage(e)}"`)
}

function handlePublishError (e) {
  info(`Publish failed with message "${getErrorMessage(e)}"`)

  throw e
}

function handleConsumeError (e) {
  info(`Consume failed with message "${getErrorMessage(e)}"`)

  throw e
}

export async function publish (params = {}, content = {}, routingKey = getRoutingKey(params)) {
  log('publish')

  return await (
    amqpConnect({ ...params, content, routingKey })
      .then(connectionCreateChannel)
      .then(channelAssertExchange)
      .then(channelAssertQueue)
      .then(channelPublish)
      .then(amqpDisconnect)
      .catch(handlePublishError)
  )
}

export async function queue (params = {}, content = {}, routingKey = getRoutingKey(params)) {
  log('queue')

  return await (
    amqpConnect({ ...params, content, routingKey })
      .then(connectionCreateChannel)
      .then(channelAssertExchange)
      .then(channelAssertQueue)
      .then(channelQueue)
      .then(amqpDisconnect)
      .catch(handlePublishError)
  )
}

export async function consume (params = {}, handler = (content) => { log(content) }, routingKey = getRoutingKey(params)) {
  log('consume')

  return await (
    amqpConnect({ ...params, handler, routingKey })
      .then(connectionCreateChannel)
      .then(channelAssertExchange)
      .then(channelAssertQueue)
      .then(channelBindQueue)
      .then(channelConsume)
      .catch(handleConsumeError)
  )
}
