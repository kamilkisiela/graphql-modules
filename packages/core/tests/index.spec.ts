import "reflect-metadata";
import {
  createApp,
  createModule,
  Injector,
  Injectable,
  InjectionToken,
  MODULE_ID
} from "@graphql-modules/core";
import { makeExecutableSchema } from "graphql-tools";
import { execute, parse } from "graphql";

const Test = new InjectionToken<string>("test");

const posts = ["Foo", "Bar"];
const comments = ["Comment #1", "Comment #2"];

@Injectable()
class Posts {
  all() {
    return posts;
  }
}

@Injectable()
class Comments {
  all() {
    return comments;
  }
}

test("basic", async () => {
  const spies = {
    posts: {
      moduleId: jest.fn(),
      test: jest.fn()
    },
    comments: {
      moduleId: jest.fn(),
      test: jest.fn()
    }
  };

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
      {
        provide: Test,
        useValue: "local"
      }
    ],
    typeDefs: `
      type Post {
        title: String!
      }

      extend type Query {
        posts: [Post!]!
      }
    `,
    resolvers: {
      Query: {
        posts(_parent: {}, __args: {}, { injector }: { injector: Injector }) {
          spies.posts.moduleId(injector.get(MODULE_ID));
          spies.posts.test(injector.get(Test));

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
    typeDefs: `
      type Comment {
        text: String!
      }

      extend type Query {
        comments: [Comment!]!
      }
    `,
    resolvers: {
      Query: {
        comments(
          _parent: {},
          __args: {},
          { injector }: { injector: Injector }
        ) {
          spies.comments.moduleId(injector.get(MODULE_ID));
          spies.comments.test(injector.get(Test));

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

  const result = await execute({
    schema,
    contextValue: appModule.context({ request: {}, response: {} }),
    document: parse(/* GraphQL */ `
      {
        comments {
          text
        }
        posts {
          title
        }
      }
    `)
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
});
