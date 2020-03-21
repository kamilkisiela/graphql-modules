import "reflect-metadata";
import {
  createApp,
  createModule,
  MODULE_ID,
  ModuleContext,
  testModule
} from "@graphql-modules/core";
import {
  Injectable,
  InjectionToken,
  ProviderScope,
} from '@graphql-modules/di';
import { makeExecutableSchema } from "graphql-tools";
import { execute, parse } from "graphql";

const Test = new InjectionToken<string>("test");

const posts = ["Foo", "Bar"];
const comments = ["Comment #1", "Comment #2"];

test("basic", async () => {
  const spies = {
    logger: jest.fn(),
    posts: {
      moduleId: jest.fn(),
      test: jest.fn(),
      postService: jest.fn(),
      eventService: jest.fn()
    },
    comments: {
      moduleId: jest.fn(),
      test: jest.fn(),
      commentsService: jest.fn()
    }
  };

  @Injectable({
    scope: ProviderScope.Operation
  })
  class Logger {
    constructor() {
      spies.logger();
    }

    log() {}
  }

  @Injectable({
    scope: ProviderScope.Operation
  })
  class Events {
    constructor() {
      spies.posts.eventService();
    }

    emit() {}
  }

  @Injectable()
  class Posts {
    constructor() {
      spies.posts.postService();
    }

    all() {
      return posts;
    }
  }

  @Injectable()
  class Comments {
    constructor() {
      spies.comments.commentsService();
    }

    all() {
      return comments;
    }
  }

  // Child module
  const commonModule = createModule({
    id: "common",
    typeDefs: /* GraphQL */ `
      type Query {
        _noop: String
      }
    `
  });

  // Child module
  const postsModule = createModule({
    id: "posts",
    providers: [
      Posts,
      Events,
      {
        provide: Test,
        useValue: "local"
      }
    ],
    typeDefs: /* GraphQL */ `
      type Post {
        title: String!
      }

      extend type Query {
        posts: [Post!]!
      }
    `,
    resolvers: {
      Query: {
        posts(_parent: {}, __args: {}, { injector }: ModuleContext) {
          spies.posts.moduleId(injector.get(MODULE_ID));
          spies.posts.test(injector.get(Test));
          injector.get(Events).emit();
          injector.get(Logger).log();

          return injector.get(Posts).all();
        }
      },
      Post: {
        title: (title: any) => title
      }
    }
  });

  // Child module
  const commentsModule = createModule({
    id: "comments",
    providers: [Comments],
    typeDefs: /* GraphQL */ `
      type Comment {
        text: String!
      }

      extend type Query {
        comments: [Comment!]!
      }
    `,
    resolvers: {
      Query: {
        comments(_parent: {}, __args: {}, { injector }: ModuleContext) {
          spies.comments.moduleId(injector.get(MODULE_ID));
          spies.comments.test(injector.get(Test));
          injector.get(Logger).log();

          return injector.get(Comments).all();
        }
      },
      Comment: {
        text: (text: any) => text
      }
    }
  });

  // root module as application
  const appModule = createApp({
    modules: [commonModule, postsModule, commentsModule],
    providers: [
      Logger,
      {
        provide: Test,
        useValue: "global"
      }
    ]
  });

  // create schema
  const schema = makeExecutableSchema({
    typeDefs: appModule.typeDefs,
    resolvers: appModule.resolvers
  });

  const createContext = () => appModule.context({ request: {}, response: {} });
  const document = parse(/* GraphQL */ `
    {
      comments {
        text
      }
      posts {
        title
      }
    }
  `);

  const result = await execute({
    schema,
    contextValue: createContext(),
    document
  });

  // Should resolve data correctly
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    comments: comments.map(text => ({ text })),
    posts: posts.map(title => ({ title }))
  });

  // Child Injector has priority over Parent Injector
  expect(spies.posts.test).toHaveBeenCalledWith("local");
  expect(spies.comments.test).toHaveBeenCalledWith("global");

  // Value of MODULE_ID according to module's resolver
  expect(spies.posts.moduleId).toHaveBeenCalledWith("posts");
  expect(spies.comments.moduleId).toHaveBeenCalledWith("comments");

  await execute({
    schema,
    contextValue: createContext(),
    document
  });

  // Singleton providers should be called once
  expect(spies.posts.postService).toHaveBeenCalledTimes(1);
  expect(spies.comments.commentsService).toHaveBeenCalledTimes(1);

  // Operation provider should be called twice
  expect(spies.posts.eventService).toHaveBeenCalledTimes(2);
  expect(spies.logger).toHaveBeenCalledTimes(2);
});

test("testModule testing util", async () => {
  @Injectable()
  class Posts {
    all() {
      return posts;
    }
  }
  const postsModule = createModule({
    id: "posts",
    providers: [Posts],
    typeDefs: /* GraphQL */ `
      type Post {
        title: String!
      }

      extend type Query {
        posts: [Post!]!
      }
    `,
    resolvers: {
      Query: {
        posts(_parent: {}, __args: {}, { injector }: ModuleContext) {
          return injector.get(Posts).all();
        }
      },
      Post: {
        title: (title: any) => title
      }
    }
  });

  const mockedModule = testModule(postsModule);

  const result = await execute({
    schema: mockedModule.schema,
    contextValue: mockedModule.context({ request: {}, response: {} }),
    document: parse(/* GraphQL */ `
      {
        posts {
          title
        }
      }
    `)
  });

  // Should resolve data correctly
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: posts.map(title => ({ title }))
  });
});
