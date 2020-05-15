import {
  Provider,
  ReflectiveInjector,
  onlySingletonProviders,
  onlyOperationProviders,
} from "@graphql-modules/di";
import {
  execute,
  DocumentNode,
  GraphQLSchema,
  ExecutionArgs,
  ExecutionResult,
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { REQUEST, RESPONSE } from "./tokens";
import {
  ModuleContext,
  GraphQLModule,
  ResolvedGraphQLModule,
} from "../module/module";
import { Resolvers } from "../module/types";
import { ID, Single, Maybe, PromiseOrValue } from "../shared/types";
import { ModuleDuplicatedError } from "../shared/errors";
import { flatten, isDefined } from "../shared/utils";
import {
  ResolveMiddlewareMap,
  normalizeResolveMiddlewareMap,
} from "../shared/middleware";

type Execution = {
  (args: ExecutionArgs): PromiseOrValue<ExecutionResult>;
  (
    schema: GraphQLSchema,
    document: DocumentNode,
    rootValue?: any,
    contextValue?: any,
    variableValues?: Maybe<{ [key: string]: any }>,
    operationName?: Maybe<string>,
    fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>,
    typeResolver?: Maybe<GraphQLTypeResolver<any, any>>
  ): PromiseOrValue<ExecutionResult>;
};

type ExecutionContextBuilder<
  TContext extends {
    request: any;
    response?: any;
    [key: string]: any;
  } = {
    request: any;
    response?: any;
  }
> = (
  context: TContext
) => {
  context: AppContext;
  onDestroy: () => void;
};

export type GraphQLApp = {
  readonly typeDefs: DocumentNode[];
  readonly resolvers?: Single<Resolvers>;
  readonly schema: GraphQLSchema;
  createExecution(options?: { execute?: typeof execute }): Execution;
};

export interface AppConfig {
  modules: GraphQLModule[];
  providers?: Provider[];
  resolveMiddlewares?: ResolveMiddlewareMap;
}

export type ModulesMap = Map<ID, ResolvedGraphQLModule>;

export interface AppContext {
  ɵgetModuleContext(moduleId: ID, context: any): ModuleContext;
}

export function createApp(config: AppConfig): GraphQLApp {
  const appInjector = ReflectiveInjector.create(
    "App (Singleton Scope)",
    onlySingletonProviders(config.providers)
  );
  const appOperationProviders = onlyOperationProviders(config.providers);
  const resolveMiddlewareMap = normalizeResolveMiddlewareMap(
    config.resolveMiddlewares
  );
  appInjector.instantiateAll();

  const modules = config.modules.map((mod) =>
    mod.factory({
      injector: appInjector,
      resolveMiddlewares: resolveMiddlewareMap,
    })
  );
  const moduleMap = createModuleMap(modules);

  const typeDefs = flatten(modules.map((mod) => mod.typeDefs));
  const resolvers = modules.map((mod) => mod.resolvers).filter(isDefined);
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const contextBuilder: ExecutionContextBuilder = (context) => {
    const contextCache: Record<ID, ModuleContext> = {};
    let providersToDestroy: Array<[ReflectiveInjector, number]> = [];

    function registerProvidersToDestroy(injector: ReflectiveInjector) {
      injector._providers.forEach((provider) => {
        if (provider.factory.hasOnDestroyHook) {
          // keep provider key's id (it doesn't change over time)
          // and related injector
          providersToDestroy.push([injector, provider.key.id]);
        }
      });
    }

    const appContextInjector = ReflectiveInjector.create(
      "App (Operation Scope)",
      appOperationProviders.concat(
        {
          provide: REQUEST,
          useValue: context.request,
        },
        {
          provide: RESPONSE,
          useValue: context.response,
        }
      ),
      appInjector
    );

    registerProvidersToDestroy(appContextInjector);

    return {
      onDestroy() {
        providersToDestroy.forEach(([injector, keyId]) => {
          if (injector._isObjectDefinedByKeyId(keyId)) {
            injector._getObjByKeyId(keyId).onDestroy();
          }
        });
      },
      context: {
        ...(context || {}),
        ɵgetModuleContext(moduleId, ctx) {
          if (!contextCache[moduleId]) {
            const providers = moduleMap.get(moduleId)?.operationProviders!;
            const moduleInjector = moduleMap.get(moduleId)!.injector;

            const singletonModuleInjector = ReflectiveInjector.createWithExecutionContext(
              moduleInjector,
              () => contextCache[moduleId]
            );
            const moduleContextInjector = ReflectiveInjector.create(
              `Module "${moduleId}" (Operation Scope)`,
              providers,
              singletonModuleInjector,
              appContextInjector
            );

            registerProvidersToDestroy(moduleContextInjector);

            contextCache[moduleId] = {
              ...ctx,
              injector: moduleContextInjector,
              moduleId,
            };
          }

          return contextCache[moduleId];
        },
      },
    };
  };

  return {
    typeDefs,
    resolvers,
    schema,
    createExecution(options): Execution {
      const executeFn = options?.execute || execute;

      return (
        argsOrSchema: ExecutionArgs | GraphQLSchema,
        document?: DocumentNode,
        rootValue?: any,
        contextValue?: any,
        variableValues?: Maybe<{ [key: string]: any }>,
        operationName?: Maybe<string>,
        fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>,
        typeResolver?: Maybe<GraphQLTypeResolver<any, any>>
      ) => {
        const { context, onDestroy } = contextBuilder(
          isExecutionArgs(argsOrSchema)
            ? argsOrSchema.contextValue
            : contextValue
        );

        const executionArgs: ExecutionArgs = isExecutionArgs(argsOrSchema)
          ? {
              ...argsOrSchema,
              contextValue: context,
            }
          : {
              schema: argsOrSchema,
              document: document!,
              rootValue,
              contextValue: context,
              variableValues,
              operationName,
              fieldResolver,
              typeResolver,
            };

        return Promise.resolve()
          .then(() => executeFn(executionArgs))
          .finally(onDestroy);
      };
    },
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

function isExecutionArgs(obj: any): obj is ExecutionArgs {
  return obj instanceof GraphQLSchema === false;
}
