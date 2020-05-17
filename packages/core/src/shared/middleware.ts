import { GraphQLResolveInfo } from "graphql";
import { mergeDeepWith } from "ramda";
import { ModuleMetadata } from "./../module/metadata";
import { ModuleContext } from "../module/module";
import { isDefined } from "./utils";
import { ExtraMiddlewareError, useLocation } from "./errors";

export type Next<T = any> = () => Promise<T>;

export type Middleware<TContext = {}> = (
  context: TContext,
  next: Next
) => Promise<any>;

export function compose<TContext = {}>(
  middleware: Array<Middleware<TContext>>
) {
  if (!Array.isArray(middleware)) {
    throw new TypeError("Middleware stack must be an array!");
  }

  for (const fn of middleware) {
    if (typeof fn !== "function") {
      throw new TypeError("Middleware must be composed of functions!");
    }
  }

  return function composed(context: TContext, next: Next) {
    // last called middleware
    let index = -1;

    function dispatch(i: number): Promise<any> {
      if (i <= index) {
        return Promise.reject(new Error("next() called multiple times"));
      }

      index = i;

      const fn = i === middleware.length ? next : middleware[i];

      if (!fn) {
        return Promise.resolve();
      }

      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}

export interface ResolveMiddlewareContext<
  TContext extends ModuleContext = ModuleContext
> {
  root: any;
  args: {
    [argName: string]: any;
  };
  context: TContext;
  info: GraphQLResolveInfo;
}

export type ResolveMiddleware<
  TContext extends ModuleContext = ModuleContext
> = (context: ResolveMiddlewareContext<TContext>, next: Next) => Promise<any>;

export type ResolveMiddlewareMap = Record<string, Array<ResolveMiddleware>>;
export interface NormalizedResolveMiddlewareMap {
  __any?: ResolveMiddleware[];
  types: {
    [type: string]: {
      __any?: ResolveMiddleware[];
      fields: {
        [field: string]: ResolveMiddleware[];
      };
    };
  };
}

export function createResolveMiddleware(
  path: string[],
  middlewareMap?: NormalizedResolveMiddlewareMap
) {
  const middlewares = middlewareMap
    ? pickResolveMiddlewares(path, middlewareMap)
    : [];

  return compose<ResolveMiddlewareContext>(middlewares);
}

export function mergeNormalizedResolveMiddlewareMaps(
  app: NormalizedResolveMiddlewareMap,
  mod: NormalizedResolveMiddlewareMap
): NormalizedResolveMiddlewareMap {
  const merge = (left: any, right: any): any => {
    return mergeDeepWith(
      (l, r) => {
        if (Array.isArray(l)) {
          return l.concat(r || []);
        }

        return merge(l, r);
      },
      left,
      right
    );
  };
  return merge(app, mod);
}

export function normalizeResolveMiddlewareMap(
  middlewaresMap?: ResolveMiddlewareMap
): NormalizedResolveMiddlewareMap {
  const normalized: NormalizedResolveMiddlewareMap = {
    types: {},
  };

  for (const pattern in middlewaresMap) {
    if (middlewaresMap.hasOwnProperty(pattern)) {
      const middlewares = middlewaresMap[pattern];

      const [type, field] = pattern.split(".");

      if (type === "*") {
        normalized.__any = middlewares;

        if (typeof field === "string") {
          throw new Error(
            `Pattern "${pattern}" is not allowed. Use "*" instead`
          );
        }

        continue;
      }

      if (!normalized.types[type]) {
        normalized.types[type] = {
          fields: {},
        };
      }

      if (field === "*") {
        normalized.types[type].__any = middlewares;
        continue;
      }

      normalized.types[type].fields[field] = middlewares;
    }
  }

  return normalized;
}

function pickResolveMiddlewares(
  path: string[],
  middlewareMap: NormalizedResolveMiddlewareMap
) {
  const middlewares: ResolveMiddleware[] = [];

  const [type, field] = path;

  if (middlewareMap.__any) {
    middlewares.push(...middlewareMap.__any);
  }

  const typeMap = middlewareMap.types[type];

  if (typeMap) {
    if (typeMap.__any) {
      middlewares.push(...typeMap.__any);
    }

    if (field && typeMap.fields[field]) {
      middlewares.push(...typeMap.fields[field]);
    }
  }

  return middlewares.filter(isDefined);
}

export function validateResolveMiddlewareMap(
  middlewareMap: NormalizedResolveMiddlewareMap,
  metadata: ModuleMetadata
) {
  const exists = checkExistence(metadata);

  for (const typeName in middlewareMap.types) {
    if (middlewareMap.types.hasOwnProperty(typeName)) {
      const typeMiddlewareMap = middlewareMap.types[typeName];

      if (!exists.type(typeName)) {
        throw new ExtraMiddlewareError(
          `Cannot apply a middleware to non existing "${typeName}" type`,
          useLocation({ dirname: metadata.dirname, id: metadata.id })
        );
      }

      for (const fieldName in typeMiddlewareMap.fields) {
        if (typeMiddlewareMap.fields.hasOwnProperty(fieldName)) {
          if (!exists.field(typeName, fieldName)) {
            throw new ExtraMiddlewareError(
              `Cannot apply a middleware to non existing "${typeName}.${fieldName}" type.field`,
              useLocation({ dirname: metadata.dirname, id: metadata.id })
            );
          }
        }
      }
    }
  }
}

/**
 * Helps to make sure a middleware has a corresponding type/field definition.
 * We don't want to pass a module-level middlewares that are not related to the module.
 * Not because it's dangerous but to prevent unused middlewares.
 */
function checkExistence(metadata: ModuleMetadata) {
  return {
    type(name: string) {
      return isDefined(metadata.implements?.[name] || metadata.extends?.[name]);
    },
    field(type: string, name: string) {
      return isDefined(
        metadata.implements?.[type]?.includes(name) ||
          metadata.extends?.[type]?.includes(name)
      );
    },
  };
}
