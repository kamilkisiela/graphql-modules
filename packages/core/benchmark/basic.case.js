const Benchmark = require("benchmark");
const { createApp, createModule, InjectionToken } = require("../dist");
const { parse, execute } = require("graphql");
const { makeExecutableSchema } = require("graphql-tools");
const { deepEqual } = require("assert");

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
          posts(_parent, __args) {
            return posts;
          }
        },
        Post: {
          title: title => title
        }
      }
    })
  ]
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
          }
        }
      ],
      resolvers: {
        Query: {
          posts(_parent, __args, { injector }) {
            return injector.get(PostsToken).all();
          }
        },
        Post: {
          title: title => title
        }
      }
    })
  ]
});

const pureSchema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
      posts() {
        return posts;
      }
    },
    Post: {
      title: title => title
    }
  }
});

let showedError = false;

async function graphql(schema, context) {
  const { data, errors } = await execute({
    schema,
    document: parse(/* GraphQL */ `
      query getPosts {
        posts {
          title
        }
      }
    `),
    contextValue: context({ request: {}, response: {} })
  });

  if (errors && !showedError) {
    console.log(errors);
    showedError = true;
  }

  deepEqual(errors, undefined);
  deepEqual(data, {
    posts: [
      {
        title: "Foo"
      },
      {
        title: "Bar"
      }
    ]
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
  .on("cycle", event => {
    console.log(String(event.target));
  })
  .on("error", error => {
    console.log(error);
  })
  .on("complete", function() {
    console.log("Fastest is " + this.filter("fastest").map("name"));
  })
  .run({ async: true });
