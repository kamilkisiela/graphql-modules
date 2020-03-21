import {
  ReflectiveInjector,
  onlySingletonProviders
} from "@graphql-modules/di";
import { GraphQLModule, ModuleConfig } from "./module";
import { metadataFactory } from "./metadata";
import { createResolvers } from "./resolvers";
import { createTypeDefs } from "./type-defs";
import { MODULE_ID } from "../app/tokens";

export type ModuleFactoryInput = {
  injector: ReflectiveInjector;
};
export type ModuleFactory = (input: ModuleFactoryInput) => GraphQLModule;

export function moduleFactory(config: ModuleConfig): ModuleFactory {
  const typeDefs = createTypeDefs(config);
  const metadata = metadataFactory(typeDefs, config);
  const resolvers = createResolvers(config, metadata);

  return (parent: ModuleFactoryInput) => {
    const providers = onlySingletonProviders(config.providers) || [];

    return {
      id: config.id,
      typeDefs,
      resolvers,
      metadata,
      providers: config.providers,
      injector: new ReflectiveInjector(
        providers.concat({
          provide: MODULE_ID,
          useValue: config.id
        }),
        parent.injector
      )
    };
  };
}
