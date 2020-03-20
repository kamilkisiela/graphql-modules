import { DocumentNode, GraphQLSchema } from "graphql";
import { makeExecutableSchema } from "graphql-tools";
import { ReflectiveInjector, Provider } from "injection-js";
import { REQUEST, RESPONSE, MODULES, MODULE_ID } from "./tokens";
import { GraphQLModule, ModuleContext } from "../module/module";
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

export type ModulesMap = Map<ID, GraphQLModule>;

export interface AppContext {
  ɵgetModuleContext(moduleId: ID, context: any): ModuleContext;
}

export function createApp(config: AppConfig): GraphQLApp {
  const modules = createModuleMap(config.modules);

  const typeDefs = flatten(config.modules.map(mod => mod.typeDefs));
  const resolvers = config.modules.map(mod => mod.resolvers).filter(isDefined);
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
      const injector = ReflectiveInjector.resolveAndCreate(
        (config.providers || []).concat(
          {
            provide: REQUEST,
            useValue: request
          },
          {
            provide: RESPONSE,
            useValue: response
          },
          {
            provide: MODULES,
            useValue: modules
          }
        )
      );

      const contextCache: Record<ID, ModuleContext> = {};

      return {
        ɵgetModuleContext(moduleId, context) {
          if (!contextCache[moduleId]) {
            const providers: Provider[] = (
              modules.get(moduleId)!.providers || []
            ).concat({ provide: MODULE_ID, useValue: moduleId });

            contextCache[moduleId] = {
              ...context,
              injector: injector.resolveAndCreateChild(providers),
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
