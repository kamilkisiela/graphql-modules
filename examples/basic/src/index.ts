import "reflect-metadata";
import express from "express";
import { createServer } from "http";
import { ApolloServer } from "apollo-server-express";
import { createApp } from "graphql-modules";
import { postsModule } from "./posts";

// GraphQL Modules

const app = createApp({
  modules: [postsModule],
});

const execute = app.createExecution();
const subscribe = app.createSubscription();

// Server

const PORT = 3000;
const server = express();

const apollo = new ApolloServer({
  schema: app.schema,
  executeFn: execute,
  subscribeFn: subscribe,
  context({ req, res }) {
    return { request: req, response: res };
  },
})

apollo.applyMiddleware({
  app: server,
  path: "/graphql",
});

const httpServer = createServer(server);

apollo.installSubscriptionHandlers(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Live at http://localhost:${PORT}`);
});
