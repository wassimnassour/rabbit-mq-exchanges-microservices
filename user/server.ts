import * as express from "express"

import {
  initRabbitMq,
  publishMessageWithExchange,
} from "./rabbit-mq/config/rabbitMq"

import "dotenv/config"

const app = express()

app.use(express.json())

initRabbitMq().then(() => {})

app.get("/", (req, res) => {
  res.send("Hello, World!, userService")
})

app.post("/user", async (req, res) => {
  console.log("req", req.body)
  const value = await publishMessageWithExchange({
    // queueName: "order.created",
    exchangeKey: "order.created.exchange",
    routingKey: "order.created",
    exchangeType: "direct",
    message: JSON.stringify(req.body?.message),
  })

  console.log("value", value)
  res.send("Hello, World 312312")
})

app.post("/user2", async (req, res) => {
  const value = await publishMessageWithExchange({
    // queueName: "order.created",
    exchangeKey: "order.deleted.exchange",
    routingKey: "order.deleted",
    exchangeType: "direct",
    message: JSON.stringify("This is message"),
  })

  console.log("value", value)
  res.send("Hello, World 312312")
})

app.listen(4000, () => {
  console.error("Server is running on port 4000")
})
