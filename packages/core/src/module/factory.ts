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

export type ModuleFactoryInput = {
  injector: ReflectiveInjector;
};
export type ModuleFactory = (
  input: ModuleFactoryInput
) => ResolvedGraphQLModule;

export function moduleFactory(config: ModuleConfig): GraphQLModule {
  const typeDefs = createTypeDefs(config);
  const metadata = metadataFactory(typeDefs, config);

  const mod: GraphQLModule = {
    id: config.id,
    metadata,
    typeDefs,
    providers: config.providers,
    factory(parent) {
      const resolvedModule: Partial<ResolvedGraphQLModule> = mod;

      resolvedModule.operationProviders = onlyOperationProviders(
        config.providers
      );
      resolvedModule.singletonProviders = onlySingletonProviders(
        config.providers
      );

      const injector = new ReflectiveInjector(
        resolvedModule.singletonProviders.concat({
          provide: MODULE_ID,
          useValue: config.id,
        }),
        parent.injector
      );

      injector.instantiateAll();

      // We attach injector property to existing `mod` object
      // because we want to keep references
      // that are later on used in testing utils
      (resolvedModule as any).injector = injector;

      resolvedModule.resolvers = createResolvers(config, metadata);

      return resolvedModule as ResolvedGraphQLModule;
    },
  };

  return mod;
}
