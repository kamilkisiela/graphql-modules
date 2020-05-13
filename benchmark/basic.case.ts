import Benchmark from "benchmark";
import { createApp, createModule, InjectionToken } from "@graphql-modules/core";
import { parse, execute, GraphQLSchema } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { deepEqual } from "assert";

const suite = new Benchmark.Suite();

const typeDefs = parse(/* GraphQL */ `
  type Post {
    title: String!
  }

  type Query {
    posts: [Post!]!
  }
`);
const posts = ["Foo", "Bar"];
const app = createApp({
  modules: [
    createModule({
      id: "posts",
      typeDefs,
      resolvers: {
        Query: {
          posts(_parent: string, __args: any) {
            return posts;
          },
        },
        Post: {
          title: (title: string) => title,
        },
      },
    }),
  ],
});

class Posts {
  all() {
    return posts;
  }
}

const PostsToken = new InjectionToken("Posts");

const appWithDI = createApp({
  modules: [
    createModule({
      id: "posts",
      typeDefs,
      providers: [
        {
          provide: PostsToken,
          useFactory() {
            return new Posts();
          },
        },
      ],
      resolvers: {
        Query: {
          posts(_parent: any, __args: any, { injector }: any) {
            return injector.get(PostsToken).all();
          },
        },
        Post: {
          title: (title: string) => title,
        },
      },
    }),
  ],
});

const pureSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
      posts() {
        return posts;
      },
    },
    Post: {
      title: (title) => title,
    },
  },
});

let showedError = false;

async function graphql(schema: GraphQLSchema, context: any) {
  const { data, errors } = await execute({
    schema,
    document: parse(/* GraphQL */ `
      query getPosts {
        posts {
          title
        }
      }
    `),
    contextValue: context({ request: {}, response: {} }),
  });

  if (errors && !showedError) {
    console.log(errors);
    showedError = true;
  }

  deepEqual(errors, undefined);
  deepEqual(data, {
    posts: [
      {
        title: "Foo",
      },
      {
        title: "Bar",
      },
    ],
  });
}

// add tests
suite
  .add("GraphQL-JS", async () => {
    await graphql(pureSchema, () => ({}));
  })
  .add("GraphQL Modules w/o DI", async () => {
    await graphql(app.schema, app.context);
  })
  .add("GraphQL Modules w DI", async () => {
    await graphql(appWithDI.schema, appWithDI.context);
  })
  .on("cycle", (event: any) => {
    console.log(String(event.target));
  })
  .on("error", (error: any) => {
    console.log(error);
  })
  .run({ async: true });
