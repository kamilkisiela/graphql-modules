export {
  Injector,
  Inject,
  Injectable,
  Optional,
  ExecutionContext,
  Provider,
  FactoryProvider,
  ClassProvider,
  ValueProvider,
  TypeProvider,
  forwardRef,
  InjectionToken,
  Scope,
} from "@graphql-modules/di";

export interface OnDestroy {
  onDestroy(): void;
}
