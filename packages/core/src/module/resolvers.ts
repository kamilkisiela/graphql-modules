import { ModuleConfig } from "./module";
import { GraphQLResolveInfo, GraphQLScalarType } from "graphql";
import { Resolvers } from "./types";
import { ModuleMetadata } from "./metadata";
import { AppContext } from "./../app/app";
import { Single, ResolveFn, ID } from "./../shared/types";
import {
  useLocation,
  ExtraResolverError,
  ResolverDuplicatedError,
  ResolverInvalidError,
} from "./../shared/errors";
import { isNil, isDefined, isPrimitive } from "../shared/utils";
import {
  createResolveMiddleware,
  normalizeResolveMiddlewareMap,
  mergeNormalizedResolveMiddlewareMaps,
  NormalizedResolveMiddlewareMap,
} from "../shared/middleware";

const resolverMetadataProp = Symbol("metadata");

interface ResolverMetadata {
  moduleId: ID;
}

export function createResolvers(
  config: ModuleConfig,
  metadata: ModuleMetadata,
  app: {
    resolveMiddlewareMap: NormalizedResolveMiddlewareMap;
  }
) {
  const ensure = ensureImplements(metadata);
  const middlewareMap = mergeNormalizedResolveMiddlewareMaps(
    app.resolveMiddlewareMap,
    normalizeResolveMiddlewareMap(config.resolveMiddlewares)
  );

  // TODO: support `__isTypeOf`
  // TODO: support Schema Stitching resolver
  const resolvers = mergeResolvers(config);

  for (const typeName in resolvers) {
    if (resolvers.hasOwnProperty(typeName)) {
      const obj = resolvers[typeName];

      // TODO: support schema stitching
      if (isObjectResolver(obj)) {
        for (const fieldName in obj) {
          if (obj.hasOwnProperty(fieldName)) {
            ensure.type(typeName, fieldName);
            const path = [typeName, fieldName];

            // function
            if (isResolveFn(obj[fieldName])) {
              const resolver = wrapResolver({
                config,
                resolver: obj[fieldName],
                middlewareMap,
                path,
              });
              resolvers[typeName][fieldName] = resolver;
            } else if (isResolveOptions(obj[fieldName])) {
              // { resolve }
              if (isDefined((obj[fieldName] as any).resolve)) {
                const resolver = wrapResolver({
                  config,
                  resolver: (obj[fieldName] as any).resolve,
                  middlewareMap,
                  path,
                });
                resolvers[typeName][fieldName].resolve = resolver;
              }

              // { subscribe }
              if (isDefined((obj[fieldName] as any).subscribe)) {
                const resolver = wrapResolver({
                  config,
                  resolver: (obj[fieldName] as any).subscribe,
                  middlewareMap,
                  path,
                });
                resolvers[typeName][fieldName].subscribe = resolver;
              }
            }
          }
        }
      }
    }
  }

  return resolvers;
}

function wrapResolver({
  resolver,
  config,
  path,
  middlewareMap,
}: {
  resolver: ResolveFn<any>;
  middlewareMap: NormalizedResolveMiddlewareMap;
  config: ModuleConfig;
  path: string[];
}) {
  const middleware = createResolveMiddleware(path, middlewareMap);

  const wrappedResolver: ResolveFn<AppContext> = (
    root,
    args,
    context,
    info
  ) => {
    const ctx = {
      root,
      args,
      context: context.ɵgetModuleContext(config.id, context),
      info,
    };

    return middleware(ctx, () =>
      resolver(ctx.root, ctx.args, ctx.context, ctx.info)
    );
  };

  writeResolverMetadata(wrappedResolver, config);

  return wrappedResolver;
}

function mergeResolvers(config: ModuleConfig): Single<Resolvers> {
  if (!config.resolvers) {
    return {};
  }

  const resolvers = Array.isArray(config.resolvers)
    ? config.resolvers
    : [config.resolvers];

  const container: Single<Resolvers> = {};

  for (const currentResolvers of resolvers) {
    // TODO: support Scalars and Subscriptions
    for (const typeName in currentResolvers) {
      if (currentResolvers.hasOwnProperty(typeName)) {
        const value = currentResolvers[typeName];

        if (isNil(value)) {
          continue;
        } else if (isScalarResolver(value)) {
          addScalar({ typeName, resolver: value, container, config });
        } else if (isEnumResolver(value)) {
          addEnum({ typeName, resolver: value, container, config });
        } else if (isInterfaceOrUnionResolver(value)) {
          addInterfaceOrUnion({ typeName, fields: value, container, config });
        } else if (isObjectResolver(value)) {
          addObject({ typeName, fields: value, container, config });
        } else {
          throw new ResolverInvalidError(
            `Resolver of "${typeName}" is invalid`,
            useLocation({ dirname: config.dirname, id: config.id })
          );
        }
      }
    }
  }

  return container;
}

function addInterfaceOrUnion({
  typeName,
  fields,
  container,
  config,
}: {
  typeName: string;
  fields: InterfaceOrUnionResolver;
  container: Single<Resolvers>;
  config: ModuleConfig;
}): void {
  if (container[typeName]) {
    throw new ResolverDuplicatedError(
      `Duplicated resolver of "${typeName}" union or interface`,
      useLocation({ dirname: config.dirname, id: config.id })
    );
  }

  if (Object.keys(fields).length > 1) {
    throw new ResolverInvalidError(
      `Invalid resolver of "${typeName}" union or interface`,
      `Only __resolveType is allowed`,
      useLocation({ dirname: config.dirname, id: config.id })
    );
  }

  writeResolverMetadata(fields.__resolveType, config);
  container[typeName].__resolveType = fields.__resolveType;
}

function addObject({
  typeName,
  fields,
  container,
  config,
}: {
  typeName: string;
  fields: Record<string, any>;
  container: Single<Resolvers>;
  config: ModuleConfig;
}): void {
  if (!container[typeName]) {
    container[typeName] = {};
  }

  for (const fieldName in fields) {
    if (fields.hasOwnProperty(fieldName)) {
      const resolver = fields[fieldName];

      if (isResolveFn(resolver)) {
        if (container[typeName][fieldName]) {
          throw new ResolverDuplicatedError(
            `Duplicated resolver of "${typeName}.${fieldName}"`,
            useLocation({ dirname: config.dirname, id: config.id })
          );
        }

        writeResolverMetadata(resolver, config);
        container[typeName][fieldName] = resolver;
      } else if (isResolveOptions(resolver)) {
        if (!container[typeName][fieldName]) {
          container[typeName][fieldName] = {};
        }

        // resolve
        if (isDefined(resolver.resolve)) {
          if (container[typeName][fieldName].resolve) {
            throw new ResolverDuplicatedError(
              `Duplicated resolver of "${typeName}.${fieldName}" (resolve method)`,
              useLocation({ dirname: config.dirname, id: config.id })
            );
          }

          writeResolverMetadata(resolver.resolve, config);
          container[typeName][fieldName].resolve = resolver.resolve;
        }

        // subscribe
        if (isDefined(resolver.subscribe)) {
          if (container[typeName][fieldName].subscribe) {
            throw new ResolverDuplicatedError(
              `Duplicated resolver of "${typeName}.${fieldName}" (subscribe method)`,
              useLocation({ dirname: config.dirname, id: config.id })
            );
          }

          writeResolverMetadata(resolver.subscribe, config);
          container[typeName][fieldName].subscribe = resolver.subscribe;
        }
      }
    }
  }
}

function addScalar({
  typeName,
  resolver,
  container,
  config,
}: {
  typeName: string;
  resolver: GraphQLScalarType;
  container: Single<Resolvers>;
  config: ModuleConfig;
}): void {
  if (container[typeName]) {
    throw new ResolverDuplicatedError(
      `Duplicated resolver of scalar "${typeName}"`,
      useLocation({ dirname: config.dirname, id: config.id })
    );
  }

  writeResolverMetadata(resolver.parseLiteral, config);
  writeResolverMetadata(resolver.parseValue, config);
  writeResolverMetadata(resolver.serialize, config);

  container[typeName] = resolver;
}

function addEnum({
  typeName,
  resolver,
  container,
  config,
}: {
  typeName: string;
  resolver: EnumResolver;
  container: Single<Resolvers>;
  config: ModuleConfig;
}): void {
  if (!container[typeName]) {
    container[typeName] = {};
  }

  for (const key in resolver) {
    if (resolver.hasOwnProperty(key)) {
      const value = resolver[key];

      if (container[typeName][key]) {
        throw new ResolverDuplicatedError(
          `Duplicated resolver of "${typeName}.${key}" enum value`,
          useLocation({ dirname: config.dirname, id: config.id })
        );
      }

      container[typeName][key] = value;
    }
  }
}

function ensureImplements(metadata: ModuleMetadata) {
  return {
    type(name: string, field: string) {
      const type: string[] = []
        .concat(
          metadata.implements?.types?.[name] as any,
          metadata.extends?.types?.[name] as any
        )
        .filter(isDefined);

      if (type) {
        if (type.includes(field)) {
          return true;
        }
      }

      const id = `"${name}.${field}"`;

      throw new ExtraResolverError(
        `Resolver of "${id}" type cannot be implemented`,
        `${id} is not defined`,
        useLocation({ dirname: metadata.dirname, id: metadata.id })
      );
    },
  };
}

function writeResolverMetadata(resolver: Function, config: ModuleConfig): void {
  if (!resolver) {
    return;
  }

  (resolver as any)[resolverMetadataProp] = {
    moduleId: config.id,
  } as ResolverMetadata;
}

export function readResolverMetadata(
  resolver: ResolveFn<any>
): ResolverMetadata {
  return (resolver as any)[resolverMetadataProp];
}

//
// Resolver helpers
//

interface InterfaceOrUnionResolver {
  __resolveType(parent: any, ctx: any, info: GraphQLResolveInfo): string | void;
}

function isInterfaceOrUnionResolver(obj: any): obj is InterfaceOrUnionResolver {
  return isDefined(obj.__resolveType);
}

interface ObjectResolver {
  [key: string]: ResolveFn<any>;
}

function isObjectResolver(obj: any): obj is ObjectResolver {
  return !isDefined(obj.__resolveType);
}

function isResolveFn(value: any): value is ResolveFn<any> {
  return typeof value === "function";
}

interface ResolveOptions {
  resolve?: ResolveFn<any>;
  subscribe?: ResolveFn<any>;
}

function isResolveOptions(value: any): value is ResolveOptions {
  return isDefined(value.resolve) || isDefined(value.subscribe);
}

function isScalarResolver(obj: any): obj is GraphQLScalarType {
  return obj instanceof GraphQLScalarType;
}

interface EnumResolver {
  [key: string]: string | number | boolean;
}

function isEnumResolver(obj: any): obj is EnumResolver {
  return Object.values(obj).every(isPrimitive);
}
