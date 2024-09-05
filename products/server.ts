import * as express from "express"

import {
  initRabbitMq,
  publishMessageWithExchange,
} from "./rabbit-mq/config/rabbitMq"

import "dotenv/config"

const app = express()

app.use(express.json())

initRabbitMq()

app.get("/", (req, res) => {
  res.send("Hello, World!, userService")
})

app.post("/products", async (req, res) => {
  console.log("req", req.body)
  const value = await publishMessageWithExchange({
    // queueName: "order.created",
    exchangeKey: "products.created.exchange",
    routingKey: "products.created",
    exchangeType: "direct",
    message: JSON.stringify(req.body?.message),
  })

  console.log("value", value)
  res.send("Hello, World 312312")
})

app.delete("/products", async (req, res) => {
  const value = await publishMessageWithExchange({
    // queueName: "order.created",
    exchangeKey: "products.deleted.exchange",
    routingKey: "products.deleted",
    exchangeType: "direct",
    message: JSON.stringify("products delete"),
  })

  res.send("Hello, products delete")
})

app.listen(11000, () => {
  console.error("Server is running on port 11000")
})
