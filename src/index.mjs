import debug from 'debug'

import amqp from 'amqplib'

import connections from './args.mjs'

const log = debug('@sequencemedia/rabbit-mq')
const error = debug('@sequencemedia/rabbit-mq:error')
const info = debug('@sequencemedia/rabbit-mq:info')

log('`@sequencemedia/rabbit-mq` is awake')

const DURATION = 1000

const LIMIT = 500

const CLOSE = 60 * 1000

let CONNECTION = null

const CONNECTIONS = new Map()

const HANDLER = (content) => { log(content) }

if (connections()) setInterval(() => log({ connections: CONNECTIONS.size, connection: Boolean(CONNECTION) }), CLOSE / 2)

function sleepFor (duration = DURATION) {
  return (
    new Promise((resolve) => {
      setTimeout(resolve, duration)
    })
  )
}

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

export async function amqpConnect (params, i = 1) {
  log('amqpConnect')

  try {
    const connection = CONNECTION ?? (CONNECTION = await amqp.connect(transform(params)))

    return {
      ...params,
      connection
    }
  } catch (e) {
    const {
      code,
      message
    } = e

    if (code === 'ECONNREFUSED' || message.startsWith('Handshake terminated by server')) {
      if (i !== LIMIT) {
        await sleepFor(DURATION)

        const j = i + 1

        info(`... (${j} of ${LIMIT})`)
        return (
          await amqpConnect(params, j)
        )
      }

      throw new Error(`Limit reached for "${transform(params)}"`)
    }

    throw e
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
      handleDisconnectError(e)
    }
  }, CLOSE))
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

  return {
    ...params,
    channel,
    queue,
    exchange
  }
}

export async function channelPublish ({ channel, exchange, ...params }, i = 1) {
  log('channelPublish')

  try {
    const ROUTINGKEY = getRoutingKey(params)
    const CONTENT = getContent(params)

    channel.publish(exchange, ROUTINGKEY, encode(CONTENT)) // returns boolean

    return {
      ...params,
      channel,
      exchange
    }
  } catch ({
    code,
    message
  }) {
    error({
      ...(code ? { code } : {}),
      message
    })

    if (i !== LIMIT) {
      await sleepFor(DURATION)

      const j = i + 1

      info(`... (${j} of ${LIMIT})`)
      return (
        await channelPublish({ ...params, channel, exchange }, j)
      )
    }

    throw new Error(`Limit reached for channel "${channel}" and exchange "${exchange}"`)
  }
}

export async function channelQueue ({ channel, queue, ...params }) {
  log('channelQueue')

  const CONTENT = getContent(params)

  channel.sendToQueue(queue, encode(CONTENT)) // returns boolean

  return {
    ...params,
    channel,
    queue
  }
}

export async function channelClose ({ channel, ...params }) {
  log('channelClose')

  await channel.close()

  return {
    ...params
  }
}

export async function channelConsume ({ channel, queue, handler, ...params }, i = 1) {
  log('channelConsume')

  try {
    return await (
      channel.consume(queue, async function consumer (message) {
        log('consumer')

        channel.ack(message)

        const CONTENT = getContent(message)

        return await (
          handler({ ...message, content: decode(CONTENT) })
        )
      })
    )
  } catch ({
    code,
    message
  }) {
    error({
      ...(code ? { code } : {}),
      message
    })

    if (i !== LIMIT) {
      await sleepFor(DURATION)

      const j = i + 1

      info(`... (${j} of ${LIMIT})`)
      return (
        await channelConsume({ ...params, channel, queue, handler }, j)
      )
    }

    throw new Error(`Limit reached for channel "${channel}" and queue "${queue}"`)
  }
}

const getErrorMessage = ({ message = 'N/A' }) => message

function handleDisconnectError (e) {
  error(`Disconnect failed with message "${getErrorMessage(e)}"`)
}

function handlePublishError (e) {
  error(`Publish failed with message "${getErrorMessage(e)}"`)

  throw e
}

function handleQueueError (e) {
  error(`Queue failed with message "${getErrorMessage(e)}"`)

  throw e
}

function handleConsumeError (e) {
  error(`Consume failed with message "${getErrorMessage(e)}"`)

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
      .then(channelClose)
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
      .then(channelClose)
      .then(amqpDisconnect)
      .catch(handleQueueError)
  )
}

export async function consume (params = {}, handler = HANDLER, routingKey = getRoutingKey(params)) {
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
