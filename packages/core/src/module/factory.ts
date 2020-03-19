import { ReflectiveInjector } from "injection-js";
import { ResolvedModule, ModuleConfig, ModuleContext } from "./types";
import { metadataFactory } from "./metadata";

export interface ModuleFactoryInput {
  injector: ReflectiveInjector;
}

export type ContextFactory = (input: ModuleFactoryInput) => ModuleContext;

export function moduleFactory(config: ModuleConfig): ResolvedModule {
  // here we should do calculations and things related to typeDefs and resolvers

  if (config.resolvers) {
    if (Array.isArray(config.resolvers)) {
    }
  }

  return {
    id: config.id,
    typeDefs: {} as any,
    metadata: metadataFactory(config),
    providers: config.providers,
    // we use `context` to overwrite resolver's context (those resolvers defined in a module)
    context(parent) {
      return {
        injector: parent.injector.resolveAndCreateChild(config.providers || []),
        moduleId: config.id
      };
    }
  };
}
