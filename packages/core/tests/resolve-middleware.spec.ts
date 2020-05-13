import {
  normalizeResolveMiddlewareMap,
  mergeNormalizedResolveMiddlewareMaps,
  createResolveMiddleware,
  ResolveMiddleware,
} from "../src/shared/middleware";

test('should treat "*" as middleware applied to all resolvers', () => {
  const fn: ResolveMiddleware = async () => {};
  const normalized = normalizeResolveMiddlewareMap({
    "*": [fn],
  });

  expect(normalized.__any).toContain(fn);
});

test('should throw on "*.anything"', () => {
  const fn: ResolveMiddleware = async () => {};
  expect(() => {
    normalizeResolveMiddlewareMap({
      "*.something": [fn],
    });
  }).toThrow();
});

test("should pick __any middlewares before field and before type", async () => {
  const order: string[] = [];

  function createFn(label: string): ResolveMiddleware {
    return (_, next) => {
      order.push(label);
      return next();
    };
  }

  const normalized = normalizeResolveMiddlewareMap({
    "*": [createFn("*")],
    "Query.*": [createFn("Query.*")],
    "Query.foo": [createFn("Query.foo")],
  });

  const middleware = createResolveMiddleware(["Query", "foo"], normalized);

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
  const normalized = normalizeResolveMiddlewareMap({
    "*": [async () => "intercepted"],
  });

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
  const normalized = normalizeResolveMiddlewareMap({
    "*": [
      async () => {
        throw new Error("intercepted");
      },
    ],
  });

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

  const app = normalizeResolveMiddlewareMap({
    "*": [createFn("app - *")],
    "Query.*": [createFn("app - Query.*")],
    "Query.foo": [createFn("app - Query.foo")],
  });

  const mod = normalizeResolveMiddlewareMap({
    "*": [createFn("mod - *")],
    "Query.*": [createFn("mod - Query.*")],
    "Query.foo": [createFn("mod - Query.foo")],
  });

  const merged = mergeNormalizedResolveMiddlewareMaps(app, mod);

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
