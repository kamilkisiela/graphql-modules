import { ReflectiveInjector } from "injection-js";
import { ResolvedModule, ModuleConfig, ModuleContext } from "./types";
import { metadataFactory } from "./metadata";
import { createResolvers } from "./resolvers";
import { createTypeDefs } from "./type-defs";

export interface ModuleFactoryInput {
  injector: ReflectiveInjector;
}

export type ContextFactory = (input: ModuleFactoryInput) => ModuleContext;

export function moduleFactory(config: ModuleConfig): ResolvedModule {
  // here we should do calculations and things related to typeDefs and resolvers

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
