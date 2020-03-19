import { Resolvers, ModuleConfig } from "./types";
import { ModuleMetadata } from "./metadata";
import { AppContext } from "./../app/types";
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

  const resolvers = mergeResolvers(config.resolvers!, config);

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
            const resolver = obj[fieldName];

            resolvers[typeName][fieldName] = ((parent, args, context, info) => {
              return resolver(
                parent,
                args,
                {
                  ...context,
                  ...context.ɵgetModuleContext(config.id)
                },
                info
              );
            }) as ResolveFn<AppContext>;

            // resolvers[typeName][fieldName][resolverMetadataProp] =
          }
        }
      }
    }
  }
}

function isObjectType(obj: any): obj is Record<string, ResolveFn<any>> {
  return obj && typeof obj === "object";
}

function mergeResolvers(
  resolvers: Resolvers,
  config: ModuleConfig
): Single<Resolvers> {
  if (!Array.isArray(resolvers)) {
    return resolvers;
  }

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
              const location = config.dirname
                ? `Located at ${config.dirname}`
                : `Hint: pass __dirname to "dirname" option of your modules to get more insightful errors :)`;
              throw new ResolverDuplicatedError(
                `Duplicated resolver of "${typeName}.${fieldName}"`,
                `Resolver is defined by "${config.id}" module`,
                location
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
      const type = metadata.implements?.types?.[name];

      if (type) {
        if (type.includes(field)) {
          return true;
        }
      }

      const id = `"${name}.${field}"`;

      throw new ExtraResolverError(
        `Resolver of ${id} type cannot be implemented`,
        `${id} is not defined`
      );
    }
  };
}

function writeResolverMetadata(
  resolver: ResolveFn<any>,
  config: ModuleConfig
): void {
  resolver[resolverMetadataProp] = {
    moduleId: config.id
  } as ResolverMetadata;
}

export function readResolverMetadata(
  resolver: ResolveFn<any>
): ResolverMetadata {
  return resolver[resolverMetadataProp];
}
