import { DocumentNode } from "graphql";
import { Plural } from "../shared/types";

export type TypeDefs = Plural<DocumentNode | string>;
export type Resolvers = Plural<Record<string, any>>;