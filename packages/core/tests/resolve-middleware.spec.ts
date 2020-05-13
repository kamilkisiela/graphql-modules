import {
  normalizeResolveMiddlewaresMap,
  createResolveMiddleware,
  ResolveMiddleware,
} from "../src/shared/middleware";

test('should treat "*" as middleware applied to all resolvers', () => {
  const fn: ResolveMiddleware = async () => {};
  const normalized = normalizeResolveMiddlewaresMap({
    "*": [fn],
  });

  expect(normalized.__any).toContain(fn);
});

test('should throw on "*.anything"', () => {
  const fn: ResolveMiddleware = async () => {};
  expect(() => {
    normalizeResolveMiddlewaresMap({
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

  const normalized = normalizeResolveMiddlewaresMap({
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
  const normalized = normalizeResolveMiddlewaresMap({
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
  const normalized = normalizeResolveMiddlewaresMap({
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
