# Proposal of new GraphQL Modules

A less stricter version of GraphQL Modules.

## Key features

- Global Injector + Module Injector (with fallback to global tokens)
- Metadata with things like information about implemented types and extensions, providers and resolvers (easy to integrate Codegen and Inspector)
- No dependencies between modules (GraphQL-JS does the validation)
- No scoped context, one context for all modules
- Focused on Developer Experience and Team-based workflow
- Each resolver has metadata attached. If something goes wrong we know which module owns the resolver.
- Validation of missing tokens at runtime, right when creating a module and application

## Developer Experience

Few examples of errors.

The error below will let us know we have two modules named "Foo":

```
  ModuleDuplicatedError: Module "Foo" already exists
    Already registered module located at: Users/kamilkisiela/application/modules/foo.ts
    Duplicated module located at: Users/kamilkisiela/application/modules/bar.ts
```

It tells us when we have duplicated resolvers:

```
  ResolverDuplicatedError: Duplicated resolver of "Query.posts"
    Module "Foo" located at Users/kamilkisiela/application/modules/foo.ts

  ResolverDuplicatedError: Duplicated resolver of "Query.posts"
    Module "Foo"
    Hint: pass __dirname to "dirname" option of your modules to get more insightful errors
```

Or when we have a resolver that has no corresponding type and field:

```
  ExtraResolverError: Resolver of "Query.feed" type cannot be implemented
    "Query.feed" is not defined
    Module "Foo" located at Users/kamilkisiela/application/modules/foo.ts

  ExtraResolverError: Resolver of "Query.feed" type cannot be implemented
    "Query.feed" is not defined
    Module "Foo"
    Hint: pass __dirname to "dirname" option of your modules to get more insightful errors
```

Later on I will add more and more errors. We can even do try/catch and attach metadata to unexpected errors.

## Example app

### Module Posts

```typescript
const postsModule = createModule({
  id: "posts",
  dirname: __dirname,
  providers: [
    Posts,
    {
      provide: Logger,
      //
      // Debugging enabled!
      //
      useFactory: () => new Logger({ debug: true })
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
      posts(_, __, { injector }: ModuleContext) {
        return injector.get(Posts).all();
      }
    },
    Post: {
      title: (title: string) => title
    }
  }
});
```

```typescript
@Injectable()
class Posts {
  constructor(private logger: Logger) {}

  all() {
    // because we provided a new Logger with debugging enabled
    // the "Fetching posts" message WILL be emitted
    this.logger.debug("Fetching posts");
    return fetchPosts();
  }
}
```

### Comments module

```typescript
@Injectable()
class Comments {
  constructor(private logger: Logger) {}

  all() {
    // because we use a global Logger with disabled debugging
    // the "Fetching posts" message WILL NOT be emitted
    this.logger.debug("Fetching comments");
    return fetchCommets();
  }
}
```

```typescript
const commentsModule = createModule({
  id: "comments",
  dirname: __dirname,
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
        //
        // Accessing Posts service would throw an error
        // because it's not in Comment's injector
        //

        return injector.get(Comments).all();
      }
    },
    Comment: {
      text: (text: string) => text
    }
  }
});
```

### App module

```typescript
const appModule = createApp({
  modules: [postsModule, commentsModule],
  providers: [
    {
      provide: Logger,
      //
      // Debugging disabled!
      // Logger is now accessible in all modules
      //
      useFactory: () => new Logger({ debug: false })
    }
  ]
});
```
