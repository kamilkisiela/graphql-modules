import {
  Provider,
  ReflectiveInjector,
  onlySingletonProviders,
  onlyOperationProviders
} from "@graphql-modules/di";
import { DocumentNode, GraphQLSchema } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { REQUEST, RESPONSE } from "./tokens";
import {
  ModuleContext,
  GraphQLModule,
  ResolvedGraphQLModule
} from "../module/module";
import { Resolvers } from "../module/types";
import { ID, Single } from "../shared/types";
import { ModuleDuplicatedError } from "../shared/errors";
import { flatten, isDefined } from "../shared/utils";

export type GraphQLApp = {
  context(input: { request: any; response?: any }): AppContext;
  readonly typeDefs: DocumentNode[];
  readonly resolvers?: Single<Resolvers>;
  readonly schema: GraphQLSchema;
};

export interface AppConfig {
  modules: GraphQLModule[];
  providers?: Provider[];
}

export type ModulesMap = Map<ID, ResolvedGraphQLModule>;

export interface AppContext {
  ɵgetModuleContext(moduleId: ID, context: any): ModuleContext;
}

export function createApp(config: AppConfig): GraphQLApp {
  const appInjector = new ReflectiveInjector(
    onlySingletonProviders(config.providers)
  );
  const modules = config.modules.map(mod =>
    mod.factory({
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
      const appContextInjector = new ReflectiveInjector(
        onlyOperationProviders(config.providers).concat(
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
              moduleMap.get(moduleId)?.providers
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

function createModuleMap(modules: ResolvedGraphQLModule[]): ModulesMap {
  const moduleMap = new Map<string, ResolvedGraphQLModule>();

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
