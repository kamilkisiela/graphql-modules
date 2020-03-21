import {
  Provider,
  ReflectiveInjector,
  onlySingletonProviders,
  onlyOperationProviders
} from "@graphql-modules/di";
import { DocumentNode, GraphQLSchema } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { REQUEST, RESPONSE } from "./tokens";
import { ModuleContext, GraphQLModule } from "../module/module";
import { Resolvers } from "../module/types";
import { ID, Single } from "../shared/types";
import { ModuleDuplicatedError } from "../shared/errors";
import { flatten, isDefined } from "../shared/utils";
import { ModuleFactory } from "../module/factory";

export type GraphQLApp = {
  context(input: { request: any; response?: any }): AppContext;
  readonly typeDefs: DocumentNode[];
  readonly resolvers?: Single<Resolvers>;
  readonly schema: GraphQLSchema;
};

export interface AppConfig {
  modules: ModuleFactory[];
  providers?: Provider[];
}

export type ModulesMap = Map<ID, GraphQLModule>;

export interface AppContext {
  ɵgetModuleContext(moduleId: ID, context: any): ModuleContext;
}

export function createApp(config: AppConfig): GraphQLApp {
  const appInjector = new ReflectiveInjector(
    onlySingletonProviders(config.providers)
  );
  const modules = config.modules.map(factory =>
    factory({
      injector: appInjector
    })
  );
  const moduleMap = createModuleMap(modules);

  const typeDefs = flatten(modules.map(mod => mod.typeDefs));
  const resolvers = modules.map(mod => mod.resolvers).filter(isDefined);
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  return {
    typeDefs,
    resolvers,
    schema,
    context({
      request,
      response
    }: {
      request: any;
      response?: any;
    }): AppContext {
      // we need to filter out Singleton-scoped providers from config.providers
      const appContextInjector = new ReflectiveInjector(
        onlyOperationProviders(config.providers || []).concat(
          {
            provide: REQUEST,
            useValue: request
          },
          {
            provide: RESPONSE,
            useValue: response
          }
        ),
        appInjector
      );

      const contextCache: Record<ID, ModuleContext> = {};

      return {
        ɵgetModuleContext(moduleId, context) {
          if (!contextCache[moduleId]) {
            const providers = onlyOperationProviders(
              moduleMap.get(moduleId)?.providers || []
            );
            const moduleInjector = moduleMap.get(moduleId)!.injector;
            const moduleContextInjector = new ReflectiveInjector(
              providers,
              moduleInjector,
              appContextInjector
            );

            contextCache[moduleId] = {
              ...context,
              injector: moduleContextInjector,
              moduleId
            };
          }

          return contextCache[moduleId];
        }
      };
    }
  };
}

function createModuleMap(modules: GraphQLModule[]): ModulesMap {
  const moduleMap = new Map<string, GraphQLModule>();

  for (const module of modules) {
    if (moduleMap.has(module.id)) {
      const location = module.metadata.dirname;
      const existingLocation = moduleMap.get(module.id)?.metadata.dirname;

      const info = [];

      if (existingLocation) {
        info.push(`Already registered module located at: ${existingLocation}`);
      }

      if (location) {
        info.push(`Duplicated module located at: ${location}`);
      }

      throw new ModuleDuplicatedError(
        `Module "${module.id}" already exists`,
        ...info
      );
    }

    moduleMap.set(module.id, module);
  }

  return moduleMap;
}
