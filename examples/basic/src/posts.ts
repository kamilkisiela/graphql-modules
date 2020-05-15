import {
  createModule,
  ModuleContext,
  Injectable,
  ExecutionContext,
  OnDestroy,
  Scope,
} from "graphql-modules";

const uuid = () => Math.random().toString().substr(2);

const posts = [
  { id: uuid(), title: "First" },
  { id: uuid(), title: "Second" },
];

@Injectable()
class Posts {
  @ExecutionContext()
  context!: ExecutionContext;

  all() {
    return this.context.injector.get(PostsCollection).getAll();
  }
}

@Injectable({
  scope: Scope.Operation,
})
class PostsCollection implements OnDestroy {
  async getAll() {
    return posts;
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
  },
  providers: [Posts, PostsCollection],
});
