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

type ContextBuilder<
  TContext extends {
    request: any;
    response?: any;
    [key: string]: any;
  } = {
    request: any;
    response?: any;
  }
> = (context: TContext) => AppContext;

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
    'App (Singleton Scope)',
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

  const contextBuilder: ContextBuilder = (context) => {
    const appContextInjector = ReflectiveInjector.create(
      'App (Operation Scope)',
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

    const contextCache: Record<ID, ModuleContext> = {};

    return {
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

          contextCache[moduleId] = {
            ...ctx,
            injector: moduleContextInjector,
            moduleId,
          };
        }

        return contextCache[moduleId];
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
        if (isExecutionArgs(argsOrSchema)) {
          return executeFn({
            ...argsOrSchema,
            contextValue: contextBuilder(argsOrSchema.contextValue),
          });
        }

        return executeFn(
          argsOrSchema,
          document!,
          rootValue,
          contextBuilder(contextValue),
          variableValues,
          operationName,
          fieldResolver,
          typeResolver
        );
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
