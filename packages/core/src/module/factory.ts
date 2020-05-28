import {
  ReflectiveInjector,
  onlySingletonProviders,
  onlyOperationProviders,
} from "@graphql-modules/di";
import { GraphQLModule, ModuleConfig, ResolvedGraphQLModule } from "./module";
import { metadataFactory } from "./metadata";
import { createResolvers } from "./resolvers";
import { createTypeDefs } from "./type-defs";
import { MODULE_ID } from "../app/tokens";
import { ResolveMiddlewareMap } from "../shared/middleware";

export type ModuleFactory = (app: {
  injector: ReflectiveInjector;
  resolveMiddlewares: ResolveMiddlewareMap;
}) => ResolvedGraphQLModule;

export function moduleFactory(config: ModuleConfig): GraphQLModule {
  const typeDefs = createTypeDefs(config);
  const metadata = metadataFactory(typeDefs, config);
  const providers = typeof config.providers === 'function' ? config.providers() : config.providers;

  const mod: GraphQLModule = {
    id: config.id,
    metadata,
    typeDefs,
    providers,
    // Factory is called once on application creation,
    // before we even handle GraphQL Operation
    factory(app) {
      const resolvedModule: Partial<ResolvedGraphQLModule> = mod;

      // Filter providers and keep them this way
      // so we don't do this filtering multiple times.
      // Providers don't change over time, so it's safe to do it.
      resolvedModule.operationProviders = onlyOperationProviders(
        providers
      );
      resolvedModule.singletonProviders = onlySingletonProviders(
        providers
      );

      // Create a  module-level Singleton injector
      const injector = ReflectiveInjector.create(
        `Module "${config.id}" (Singleton Scope)`,
        resolvedModule.singletonProviders.concat({
          // with module's id, useful in Logging and stuff
          provide: MODULE_ID,
          useValue: config.id,
        }),
        app.injector
      );

      // Instantiate all providers
      // Happens only once, on app / module creation
      injector.instantiateAll();

      // We attach injector property to existing `mod` object
      // because we want to keep references
      // that are later on used in testing utils
      (resolvedModule as any).injector = injector;

      // Create resolvers object based on module's config
      // It involves wrapping a resolver with middlewares
      // and other things like validation
      resolvedModule.resolvers = createResolvers(config, metadata, {
        resolveMiddlewareMap: app.resolveMiddlewares,
      });

      return resolvedModule as ResolvedGraphQLModule;
    },
  };

  return mod;
}
