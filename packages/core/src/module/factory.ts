import {
  ReflectiveInjector,
  onlySingletonProviders
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
  const resolvers = createResolvers(config, metadata);

  const mod: GraphQLModule = {
    id: config.id,
    typeDefs,
    resolvers,
    metadata,
    providers: config.providers,
    factory(parent) {
      const injector = new ReflectiveInjector(
        onlySingletonProviders(config.providers).concat({
          provide: MODULE_ID,
          useValue: config.id
        }),
        parent.injector
      );

      // We attach injector property to existing `mod` object
      // because we want to keep references
      // that are later on used in testing utils
      (mod as any).injector = injector;

      return mod as any;
    }
  };

  return mod;
}
