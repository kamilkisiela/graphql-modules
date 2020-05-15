import "reflect-metadata";
import express from "express";
import graphqlHTTP from "express-graphql";
import { createApp } from "graphql-modules";
import { postsModule } from "./posts";

// GraphQL Modules

const app = createApp({
  modules: [postsModule],
});

const execute = app.createExecution();

// Server

const server = express();

server.use(
  "/graphql",
  graphqlHTTP((request, response) => ({
    schema: app.schema,
    customExecuteFn: execute as any,
    context: {
      request,
      response,
    },
    graphiql: true,
  }))
);

server.listen(3000, () => {
  console.log("Live at http://localhost:3000");
});
