import { ReflectiveInjector, Injector, Provider } from "injection-js";
import { GraphQLModule } from "../module/module";
import { AppConfig, ModulesMap, AppContext } from "./types";
import { ID } from "../shared/types";
import { ModuleDuplicatedError } from "../shared/errors";
import { REQUEST, RESPONSE, MODULES, MODULE_ID } from "./tokens";

export function createApp(config: AppConfig) {
  // here, we create GraphQL Schema and merge typeDefs + resolvers

  const modules = createModuleMap(config.modules);

  return {
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

      const moduleInjectors = new Map<ID, Injector>();

      return {
        ɵgetModuleContext(moduleId) {
          if (!moduleInjectors.has(moduleId)) {
            const providers: Provider[] = (
              modules.get(moduleId)!.providers || []
            ).concat({ provide: MODULE_ID, useValue: moduleId });

            moduleInjectors.set(
              moduleId,
              injector.resolveAndCreateChild(providers)
            );
          }

          return {
            injector: moduleInjectors.get(moduleId)!,
            moduleId
          };
        }
      };
    }
  };
}

export type GraphQLApp = ReturnType<typeof createApp>;

function createModuleMap(modules: GraphQLModule[]): ModulesMap {
  const moduleMap = new Map<string, GraphQLModule>();

  for (const module of modules) {
    if (moduleMap.has(module.id)) {
      const location = module.metadata.dirname;
      const existingLocation = moduleMap.get(module.id)?.metadata.dirname;

      const info = [`Module "${module.id}" already exists`];

      if (existingLocation) {
        info.push(`Registered module located at: ${existingLocation}`);
      }

      if (location) {
        info.push(`Module located at: ${location}`);
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
