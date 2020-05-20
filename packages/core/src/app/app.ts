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
import { ResolveMiddlewareMap } from "../shared/middleware";

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
  context: InternalAppContext;
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

/**
 * @internal
 */
export interface InternalAppContext {
  ɵgetModuleContext(moduleId: ID, context: any): ModuleContext;
}

export function createApp(config: AppConfig): GraphQLApp {
  // Creates an Injector with singleton classes at application level
  const appInjector = ReflectiveInjector.create(
    "App (Singleton Scope)",
    onlySingletonProviders(config.providers)
  );
  // Filter Operation-scoped providers, and keep it here
  // so we don't do it over and over again
  const appOperationProviders = onlyOperationProviders(config.providers);
  const resolveMiddlewareMap = config.resolveMiddlewares || {};

  // Instantiate all providers
  // Happens only once, on app creation
  appInjector.instantiateAll();

  // Create all modules
  const modules = config.modules.map((mod) =>
    mod.factory({
      injector: appInjector,
      resolveMiddlewares: resolveMiddlewareMap,
    })
  );
  const moduleMap = createModuleMap(modules);

  // Creating a schema, flattening the typedefs and resolvers
  // is not expensive since it happens only once
  const typeDefs = flatten(modules.map((mod) => mod.typeDefs));
  const resolvers = modules.map((mod) => mod.resolvers).filter(isDefined);
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // This is very critical. It creates an execution context.
  // It has to run on every operation.
  const contextBuilder: ExecutionContextBuilder = (context) => {
    // Cache for context per module
    const contextCache: Record<ID, ModuleContext> = {};
    // A list of providers with OnDestroy hooks
    // It's a tuple because we want to know which Injector controls the provider
    // and we want to know if the provider was even instantiated.
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

    // As the name of the Injector says, it's an Operation scoped Injector
    // Application level
    // Operation scoped - means it's created and destroyed on every GraphQL Operation
    const appContextInjector = ReflectiveInjector.create(
      "App (Operation Scope)",
      appOperationProviders.concat(
        {
          // Make request object accessible through REQUEST injection token
          provide: REQUEST,
          useValue: context.request,
        },
        {
          // Make response object accessible through RESPONSE injection token
          provide: RESPONSE,
          useValue: context.response,
        } // TODO: We may want to add a subscription here or even remove REQUEST and RESPONSE, we will see
      ),
      appInjector
    );

    // Track Providers with OnDestroy hooks
    registerProvidersToDestroy(appContextInjector);

    return {
      onDestroy() {
        providersToDestroy.forEach(([injector, keyId]) => {
          // If provider was instantiated
          if (injector._isObjectDefinedByKeyId(keyId)) {
            // call its OnDestroy hook
            injector._getObjByKeyId(keyId).onDestroy();
          }
        });
      },
      context: {
        // We want to pass the received context
        ...(context || {}),
        // Here's something vert crutial
        // It's a function that is used in module's context creation
        ɵgetModuleContext(moduleId, ctx) {
          // Reuse a context or create if not available
          if (!contextCache[moduleId]) {
            // We're interested in operation-scoped providers only
            const providers = moduleMap.get(moduleId)?.operationProviders!;
            // Module-level Singleton Injector
            const moduleInjector = moduleMap.get(moduleId)!.injector;

            // It's very important to recreate a Singleton Injector
            // and add an execution context getter function
            // We do this so Singleton provider can access the ExecutionContext via Proxy
            const singletonModuleInjector = ReflectiveInjector.createWithExecutionContext(
              moduleInjector,
              () => contextCache[moduleId]
            );

            // Create module-level Operation-scoped Injector
            const moduleContextInjector = ReflectiveInjector.create(
              `Module "${moduleId}" (Operation Scope)`,
              providers,
              // This injector has a priority
              singletonModuleInjector,
              // over this one
              appContextInjector
            );

            // Same as on application level, we need to collect providers with OnDestroy hooks
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
      // Custom or original exection function
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
        // Create an execution context
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

        // It's important to wrap the executeFn within a promise
        // so we can easily control the end of execution (with finally)
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
