import {
  createModule,
  ModuleContext,
  Injectable,
  ExecutionContext,
  OnDestroy,
  Scope,
} from "graphql-modules";
import { PubSub } from "graphql-subscriptions";

const uuid = () => Math.random().toString().substr(2);
const POST_ADDED_CHANNEL = "POST_ADDED";

const posts = [
  { id: uuid(), title: "First" },
  { id: uuid(), title: "Second" },
];

@Injectable()
class Posts {
  @ExecutionContext()
  context!: ExecutionContext;

  constructor(private pubsub: PubSub) {}

  all() {
    return this.context.injector.get(PostsCollection).getAll();
  }

  async add(title: string) {
    const newPost = await this.context.injector
      .get(PostsCollection)
      .insert(title);

    this.pubsub.publish(POST_ADDED_CHANNEL, {
      postAdded: newPost,
    });

    return newPost;
  }
}

@Injectable({
  scope: Scope.Operation,
})
class PostsCollection implements OnDestroy {
  async getAll() {
    return posts;
  }

  async insert(title: string) {
    const newPost = {
      id: uuid(),
      title,
    };

    posts.push(newPost);

    return newPost;
  }

  onDestroy() {
    console.log("destroyed");
  }
}

export const postsModule = createModule({
  id: "Posts",
  dirname: __dirname,
  typeDefs: /* GraphQL */ `
    type Query {
      posts: [Post!]
    }

    type Mutation {
      addPost(title: String!): Post!
    }

    type Subscription {
      postAdded: Post
    }

    type Post {
      id: ID!
      title: String!
    }
  `,
  resolvers: {
    Query: {
      posts(_root: {}, _args: {}, { injector }: ModuleContext) {
        return injector.get(Posts).all();
      },
    },
    Mutation: {
      addPost(
        _root: {},
        { title }: { title: string },
        { injector }: ModuleContext
      ) {
        return injector.get(Posts).add(title);
      },
    },
    Subscription: {
      postAdded: {
        subscribe(_root: {}, _args: {}, ctx: ModuleContext & { uuid: string }) {
          return ctx.injector.get(PubSub).asyncIterator(POST_ADDED_CHANNEL);
        },
      },
    },
  },
  providers: [
    Posts,
    PostsCollection,
    {
      provide: PubSub,
      useFactory() {
        return new PubSub();
      },
    },
  ],
});
