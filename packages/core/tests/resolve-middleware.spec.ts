import {
  mergeResolveMiddlewareMaps,
  createResolveMiddleware,
  ResolveMiddleware,
} from "../src/shared/middleware";

test("should pick __any middlewares before field and before type", async () => {
  const order: string[] = [];

  function createFn(label: string): ResolveMiddleware {
    return (_, next) => {
      order.push(label);
      return next();
    };
  }

  const map = {
    "*": {
      "*": [createFn("*")],
    },
    Query: {
      "*": [createFn("Query.*")],
      foo: [createFn("Query.foo")],
    },
  };

  const middleware = createResolveMiddleware(["Query", "foo"], map);

  await middleware(
    {
      root: {},
      args: {},
      context: {} as any,
      info: {} as any,
    },
    async () => null
  );

  expect(order).toEqual(["*", "Query.*", "Query.foo"]);
});

test("middleware should intercept the resolve result", async () => {
  const normalized = {
    "*": {
      "*": [async () => "intercepted"],
    },
  };

  const middleware = createResolveMiddleware(["Query", "foo"], normalized);

  const result = await middleware(
    {
      root: {},
      args: {},
      context: {} as any,
      info: {} as any,
    },
    async () => "not intercepted"
  );

  expect(result).toEqual("intercepted");
});

test("middleware should intercept the resolve function with an error", async () => {
  const normalized = {
    "*": {
      "*": [
        async () => {
          throw new Error("intercepted");
        },
      ],
    },
  };

  const middleware = createResolveMiddleware(["Query", "foo"], normalized);

  try {
    await middleware(
      {
        root: {},
        args: {},
        context: {} as any,
        info: {} as any,
      },
      async () => "not intercepted"
    );
  } catch (error) {
    expect(error.message).toEqual("intercepted");
  }

  expect.hasAssertions();
});

test("should put app first when merging", async () => {
  const order: string[] = [];

  function createFn(label: string): ResolveMiddleware {
    return (_, next) => {
      order.push(label);
      return next();
    };
  }

  const app = {
    "*": {
      "*": [createFn("app - *")],
    },
    Query: {
      "*": [createFn("app - Query.*")],
      foo: [createFn("app - Query.foo")],
    },
  };

  const mod = {
    "*": {
      "*": [createFn("mod - *")],
    },
    Query: {
      "*": [createFn("mod - Query.*")],
      foo: [createFn("mod - Query.foo")],
    },
  };

  const merged = mergeResolveMiddlewareMaps(app, mod);

  const middleware = createResolveMiddleware(["Query", "foo"], merged);

  await middleware(
    {
      root: {},
      args: {},
      context: {} as any,
      info: {} as any,
    },
    async () => null
  );

  expect(order).toEqual([
    "app - *",
    "mod - *",
    "app - Query.*",
    "mod - Query.*",
    "app - Query.foo",
    "mod - Query.foo",
  ]);
});
