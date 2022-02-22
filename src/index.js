import debug from 'debug'

import amqp from 'amqplib'

const log = debug('@sequencemedia')
const info = debug('@sequencemedia/rabbit-mq')

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
  info('getFields')

  if (fields) return fields
}

export function getProperties ({ properties }) {
  info('getProperties')

  if (properties) return properties
}

export function getContent ({ content }) {
  info('getContent')

  if (content) return content
}

export function encode (content) {
  info('encode')

  return toBuffer(toJson(content))
}

export function decode (content) {
  info('decode')

  return fromJson(toString(content))
}

export function transform (params) {
  info('transform')

  const username = getUsername(params)
  const password = getPassword(params)
  const hostname = getHostname(params)
  const port = getPort(params)
  const virtualHost = getVirtualHost(params)

  return `amqp://${username}:${password}@${hostname}:${port}/${virtualHost}`
}

export async function amqpConnect (params) {
  info('amqpConnect')

  const connection = CONNECTION || (CONNECTION = await amqp.connect(transform(params)))

  return {
    ...params,
    connection
  }
}

export async function amqpDisconnect ({ connection, ...params }) {
  info('amqpDisconnect')

  if (CONNECTIONS.has(connection)) clearTimeout(CONNECTIONS.get(connection))

  CONNECTIONS.set(connection, setTimeout(async () => {
    try {
      if (connection === CONNECTION) CONNECTION = null

      CONNECTIONS.delete(connection)

      await connection.close()
    } catch (e) {
      info(e)
    }
  }, CLOSE))

  return {
    ...params,
    connection
  }
}

export async function connectionCreateChannel ({ connection, ...params }) {
  info('connectionCreateChannel')

  const channel = await connection.createChannel()

  return {
    ...params,
    connection,
    channel
  }
}

export async function channelAssertExchange ({ channel, ...params }) {
  info('channelAssertExchange')

  const EXCHANGE = getExchange(params)

  const {
    exchange
  } = await channel.assertExchange(EXCHANGE, 'topic', { durable: true }) // , autoDelete: true })

  info(EXCHANGE, exchange)

  return {
    ...params,
    channel,
    exchange
  }
}

export async function channelAssertQueue ({ channel, ...params }) {
  info('channelAssertQueue')

  const QUEUE = getQueue(params)

  const {
    queue
  } = await channel.assertQueue(QUEUE, { durable: true }) //, autoDelete: true })

  info(QUEUE, queue)

  return {
    ...params,
    channel,
    queue
  }
}

export async function channelBindQueue ({ channel, queue, exchange, ...params }) {
  info('channelBindQueue')

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

export async function channelPublish ({ channel, queue, ...params }) {
  info('channelPublish')

  const CONTENT = getContent(params)

  channel.sendToQueue(queue, encode(CONTENT)) // returns boolean

  return {
    ...params,
    queue
  }
}

export async function channelConsume ({ channel, queue, handler, ...params }) {
  info('channelConsume')

  await channel.consume(queue, async function consumer (message) {
    info('consumer')

    const {
	  fields: {
        exchange,
        routingKey
	  } = {}
    } = message

    channel.ack(message)

    const CONTENT = getContent(message)

    info({ exchange, routingKey })

    return (
      handler({ ...message, content: decode(CONTENT) })
    )
  }) // , { noAck: true })

  return {
    ...params,
    channel,
    queue
  }
}

const getErrorMessage = ({ message = 'No error message defined' }) => message

function handlePublishError (e) {
  log(`Publish failed with message "${getErrorMessage(e)}"`)

  throw e
}

function handleConsumeError (e) {
  log(`Consume failed with message "${getErrorMessage(e)}"`)

  throw e
}

export async function publish (params = {}, content = {}, routingKey = getRoutingKey(params)) {
  info('publish')

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

export async function consume (params = {}, handler = (content) => { log(content) }, routingKey = getRoutingKey(params)) {
  info('consume')

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

process.on('exit', async () => {
  console.log('before exit ...')
  // if (CONNECTION) await CONNECTION.close()
  console.log('EXIT')
})
