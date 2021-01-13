import debug from 'debug'
import amqp from 'amqplib'

const log = debug('sequencemedia')
const info = debug('sequencemedia:rabbit-mq')

log('`sequencemedia:rabbit-mq` is awake')

export const getUsername = ({ username = 'guest' }) => username

export const getPassword = ({ password = 'guest' }) => password

export const getHostname = ({ hostname = 'localhost' }) => hostname

export const getPort = ({ port = 5672 }) => port

export const getVirtualHost = ({ virtualHost = '' }) => virtualHost

export const getExchange = ({ exchange }) => exchange

export const getQueue = ({ queue }) => queue

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
  const username = getUsername(params)
  const password = getPassword(params)
  const hostname = getHostname(params)
  const port = getPort(params)
  const virtualHost = getVirtualHost(params)

  return `amqp://${username}:${password}@${hostname}:${port}/${virtualHost}`
}

export async function amqpConnect (params) {
  info('amqpConnect')

  const connection = await amqp.connect(transform(params))

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
    channel
  }
}

export async function channelAssertExchange ({ channel, ...params }) {
  info('channelAssertExchange')

  const {
    exchange
  } = await channel.assertExchange(getExchange(params), 'topic', { durable: true })

  return {
    ...params,
    channel,
    exchange
  }
}

export async function channelAssertQueue ({ channel, ...params }) {
  info('channelAssertQueue')

  const {
    queue
  } = await channel.assertQueue(getQueue(params), { durable: true })

  return {
    ...params,
    channel,
    queue
  }
}

export async function channelBindQueue ({ channel, queue, exchange, ...params }) {
  info('channelBindQueue')

  await channel.bindQueue(queue, exchange, getRoutingKey(params))

  return {
    ...params,
    channel,
    queue,
    exchange
  }
}

export async function channelPublish ({ channel, exchange, ...params }) {
  info('channelPublish')

  return (
    channel.publish(exchange, getRoutingKey(params), encode(getContent(params)))
  )
}

export async function channelConsume ({ channel, queue, handler, ...params }) {
  info('channelConsume')

  await channel.consume(queue, (message) => handler({ ...message, content: decode(getContent(message)) }), { noAck: true })

  return {
    ...params,
    channel,
    queue
  }
}

export function publish (params = {}, content = {}, routingKey = getRoutingKey(params)) {
  info('publish')

  return (
    amqpConnect({ ...params, content, routingKey })
      .then(connectionCreateChannel)
      .then(channelAssertExchange)
      .then(channelAssertQueue)
      .then(channelPublish)
      .catch(({ message }) => {
        log(`Publish failed with message "${message}"`)
      })
  )
}

export function consume (params = {}, handler = (content) => { log(content) }, routingKey = getRoutingKey(params)) {
  info('consume')

  return (
    amqpConnect({ ...params, handler, routingKey })
      .then(connectionCreateChannel)
      .then(channelAssertExchange)
      .then(channelAssertQueue)
      .then(channelBindQueue)
      .then(channelConsume)
      .catch(({ message }) => {
        log(`Consume failed with message "${message}"`)
      })
  )
}
