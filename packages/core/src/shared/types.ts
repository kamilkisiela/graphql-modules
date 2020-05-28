import { GraphQLResolveInfo } from "graphql";

export type ID = string;
export type Nil = undefined | null;
export type Maybe<T> = T | Nil;
export type Plural<T> = T | T[];
export type Single<T> = T extends Array<infer R> ? R : T;
export type ResolveFn<TContext> = (
  parent: any,
  args: Record<string, any>,
  context: TContext,
  info: GraphQLResolveInfo
) => any;

// Kamil: somehow our build process doesn't emit `types.d.ts` file, this should force it...
export {};
