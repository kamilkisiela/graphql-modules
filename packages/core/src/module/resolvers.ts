import { ModuleConfig } from "./module";
import { Resolvers } from "./types";
import { ModuleMetadata } from "./metadata";
import { AppContext } from "./../app/app";
import { Single, ResolveFn, ID } from "./../shared/types";
import {
  ExtraResolverError,
  ResolverDuplicatedError
} from "./../shared/errors";

const resolverMetadataProp = Symbol("metadata");

interface ResolverMetadata {
  moduleId: ID;
}

export function createResolvers(
  config: ModuleConfig,
  metadata: ModuleMetadata
) {
  const ensure = ensureImplements(metadata);

  const resolvers = mergeResolvers(config);

  for (const typeName in resolvers) {
    if (resolvers.hasOwnProperty(typeName)) {
      const obj = resolvers[typeName];

      // TODO: support Scalars

      if (isObjectType(obj)) {
        for (const fieldName in obj) {
          if (obj.hasOwnProperty(fieldName)) {
            ensure.type(typeName, fieldName);

            // TODO: support schema stitching
            // TODO: support subscriptions
            const originalResolver = obj[fieldName];
            const resolver: ResolveFn<AppContext> = (
              parent,
              args,
              context,
              info
            ) => {
              return originalResolver(
                parent,
                args,
                {
                  ...context,
                  ...context.ɵgetModuleContext(config.id)
                },
                info
              );
            };

            writeResolverMetadata(resolver, config);
            resolvers[typeName][fieldName] = resolver;
          }
        }
      }
    }
  }

  return resolvers;
}

function isObjectType(obj: any): obj is Record<string, ResolveFn<any>> {
  return obj && typeof obj === "object";
}

function mergeResolvers(config: ModuleConfig): Single<Resolvers> {
  if (!config.resolvers) {
    return {};
  }

  const resolvers = Array.isArray(config.resolvers)
    ? config.resolvers
    : [config.resolvers];
  const merged: Single<Resolvers> = {};

  for (const currentResolvers of resolvers) {
    // TODO: support Scalars and Subscriptions
    for (const typeName in currentResolvers) {
      if (currentResolvers.hasOwnProperty(typeName)) {
        const fields = currentResolvers[typeName];

        if (!merged[typeName]) {
          merged[typeName] = {};
        }

        for (const fieldName in fields) {
          if (fields.hasOwnProperty(fieldName)) {
            const resolver = fields[fieldName];

            if (merged[typeName][fieldName]) {
              throw new ResolverDuplicatedError(
                `Duplicated resolver of "${typeName}.${fieldName}"`,
                useLocation({ dirname: config.dirname, id: config.id })
              );
            }

            writeResolverMetadata(resolver, config);
            merged[typeName][fieldName] = resolver;
          }
        }
      }
    }
  }

  return merged;
}

function ensureImplements(metadata: ModuleMetadata) {
  return {
    type(name: string, field: string) {
      const type =
        metadata.implements?.types?.[name] || metadata.extends?.types?.[name];

      if (type) {
        if (type.includes(field)) {
          return true;
        }
      }

      const id = `"${name}.${field}"`;

      throw new ExtraResolverError(
        `Resolver of ${id} type cannot be implemented`,
        `${id} is not defined`,
        useLocation({ dirname: metadata.dirname, id: metadata.id })
      );
    }
  };
}

function writeResolverMetadata(
  resolver: ResolveFn<any>,
  config: ModuleConfig
): void {
  (resolver as any)[resolverMetadataProp] = {
    moduleId: config.id
  } as ResolverMetadata;
}

export function readResolverMetadata(
  resolver: ResolveFn<any>
): ResolverMetadata {
  return (resolver as any)[resolverMetadataProp];
}

function useLocation({ dirname, id }: { id: ID; dirname?: string }) {
  return dirname
    ? `Module "${id}" located at ${dirname}`
    : [
        `Module "${id}"`,
        `Hint: pass __dirname to "dirname" option of your modules to get more insightful errors :)`
      ].join("\n");
}
