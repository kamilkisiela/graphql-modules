import { DocumentNode, parse, Source } from "graphql";
import { ModuleConfig } from "./types";

export function createTypeDefs(config: ModuleConfig): DocumentNode[] {
  const typeDefs = Array.isArray(config.typeDefs)
    ? config.typeDefs
    : [config.typeDefs];

  return typeDefs.map((types, i) => {
    if (typeof types === "string") {
      return parse(
        new Source(types, `Module "${config.id}" -  #${i} in the typeDefs list`)
      );
    }

    return types;
  });
}
