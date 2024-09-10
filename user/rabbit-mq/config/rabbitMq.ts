import { Channel, Connection } from "amqplib"
import * as amqplib from "amqplib"

let channel: Channel | undefined
let connection: Connection | undefined

const MAX_RETRIES = 5
const RETRY_DELAY = 5000 // 5 seconds

async function connectWithRetry(retries: number = 0): Promise<Connection> {
  try {
    const conn = await amqplib.connect(
      "amqp://guest:guest@localhost:5672" as string,
      {
        timeout: 30000,
        heartbeat: 60,
      }
    )

    conn.on("error", (err: any) => {
      console.error("RabbitMQ connection error:", err)
      setTimeout(() => connectWithRetry(), RETRY_DELAY)
    })

    conn.on("close", () => {
      console.warn("RabbitMQ connection closed. Attempting to reconnect...")
      setTimeout(() => connectWithRetry(), RETRY_DELAY)
    })

    return conn
  } catch (error) {
    console.log("error", error)
    if (retries < MAX_RETRIES) {
      console.warn(
        `Failed to connect to RabbitMQ. Retrying in ${
          RETRY_DELAY / 1000
        } seconds...`
      )
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY))
      return connectWithRetry(retries + 1)
    } else {
      console.error(
        "Max retries reached. Failed to connect to RabbitMQ:",
        error
      )
      throw error
    }
  }
}

async function connectToRabbitMQ(): Promise<Connection> {
  if (!connection) {
    connection = await connectWithRetry()
  }
  return connection
}

async function createChannel() {
  if (channel) {
    channel.on("error", (err) => {
      console.error("RabbitMQ channel error:", err)
      channel = undefined
    })

    channel.on("close", () => {
      console.warn("RabbitMQ channel closed. Will recreate on next use.")
      channel = undefined
    })
  } else {
    try {
      const conn = await connectToRabbitMQ()
      channel = await conn.createChannel()
    } catch (error) {
      console.error("Failed to create RabbitMQ channel:", error)
    }
  }

  return channel
}

async function publishMessageWithExchange({
  exchangeKey,
  exchangeType,
  message,
  routingKey,
}: {
  exchangeKey: string
  routingKey?: string
  exchangeType: "fanout" | "direct" | "topic"
  message: string
}) {
  try {
    const channel = await createChannel()

    if (!channel) {
      throw new Error("Failed to create a channel.")
    }

    // Declare the exchange
    await channel.assertExchange(exchangeKey, exchangeType, { durable: true })

    // Publish the message to the exchange
    channel.publish(exchangeKey, routingKey || "", Buffer.from(message))

    console.log("Message published to exchange:", exchangeKey)
  } catch (error) {
    console.error("Failed to publish message to RabbitMQ:", error)
  }
}
async function createQueue(queueName: string) {
  const channel = await createChannel()
  await channel?.assertQueue(queueName, { durable: true })
}

const bindQueueToExchange = async (queue, exchange, routingKey = "") => {
  if (!channel) throw new Error("RabbitMQ channel not initialized")
  await channel.bindQueue(queue, exchange, routingKey)
}

async function consumeMessages(
  queueName: string,
  callback: (value: any) => void
) {
  if (!channel) throw new Error("RabbitMQ channel not initialized")

  await channel?.consume(
    queueName,
    (message) => {
      if (message != null) {
        callback(message.content.toString())
        channel?.ack(message)
      }
    },
    { noAck: false }
  )
}

const queues = [
  {
    queueName: "order.created",
    bindings: [
      {
        exchangeKey: "order.created.exchange",
        routingKey: "order.created",
      },
    ],
  },
  {
    queueName: "order.deleted",
    bindings: [
      {
        exchangeKey: "order.deleted.exchange",
        routingKey: "order.deleted",
      },
    ],
  },
]

const exchanges = [{ name: "order-exchange", type: "fanout" }]

const declareExchanges = async () => {
  const channel = await createChannel()
  for (const exchange of exchanges) {
    await channel.assertExchange(exchange.name, exchange.type, {
      durable: true,
    })
    console.log(`Declared exchange: ${exchange.name}`)
  }
}

async function declareQueuesAndBindingToExchanges() {
  queues?.forEach(async (queue) => {
    await createQueue(queue.queueName)

    queue?.bindings?.forEach(async (binding) => {
      await bindQueueToExchange(
        queue.queueName,
        binding.exchangeKey,
        binding.routingKey
      )
    })
  })
}

async function initRabbitMq() {
  await declareExchanges()
  await declareQueuesAndBindingToExchanges()

  await consumeMessages("order.created", (message) => {
    console.log("Received message:", message)
    // Do something with the message here
  })

  await consumeMessages("order.deleted", (message) => {
    console.log("Received message: deleted message", message)
    // Do something with the message here
  })
}

export {
  connectToRabbitMQ,
  createChannel,
  createQueue,
  bindQueueToExchange,
  consumeMessages,
  initRabbitMq,
  publishMessageWithExchange,
  declareExchanges,
  declareQueuesAndBindingToExchanges,
}
