import { ReflectiveInjector } from "injection-js";
import { GraphQLModule, ModuleConfig, ModuleContext } from "./module";
import { metadataFactory } from "./metadata";
import { createResolvers } from "./resolvers";
import { createTypeDefs } from "./type-defs";

export interface ModuleFactoryInput {
  injector: ReflectiveInjector;
}

export type ContextFactory = (input: ModuleFactoryInput) => ModuleContext;

export function moduleFactory(config: ModuleConfig): GraphQLModule {
  const typeDefs = createTypeDefs(config);
  const metadata = metadataFactory(typeDefs, config);
  const resolvers = createResolvers(config, metadata);

  return {
    id: config.id,
    typeDefs,
    resolvers,
    metadata,
    providers: config.providers
  };
}