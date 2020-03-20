export type Next = () => Promise<void>;

export type Middleware<TContext = {}> = (
  context: TContext,
  next: Next
) => Promise<void>;

export function compose<TContext = {}>(middleware: Array<Middleware<TContext>>) {
  if (!Array.isArray(middleware)) {
    throw new TypeError("Middleware stack must be an array!");
  }

  for (const fn of middleware) {
    if (typeof fn !== "function") {
      throw new TypeError("Middleware must be composed of functions!");
    }
  }

  return function composed(context: TContext, next?: Next) {
    // last called middleware
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }

      index = i;

      const fn = i === middleware.length ? next : middleware[i];

      if (!fn) {
        return;
      }

      return fn(context, dispatch.bind(null, i + 1));
    }

    return dispatch(0);
  };
}
