import { DocumentNode, parse, Source } from "graphql";
import { ModuleConfig } from "./module";
import { useLocation } from "../shared/errors";

export function createTypeDefs(config: ModuleConfig): DocumentNode[] {
  const typeDefs = Array.isArray(config.typeDefs)
    ? config.typeDefs
    : [config.typeDefs];

  return typeDefs.map((types, i) => {
    if (typeof types === "string") {
      return parse(
        new Source(
          types,
          [
            `At index "${i}" in the typeDefs list.`,
            useLocation({
              id: config.id,
              dirname: config.dirname,
            }),
          ].join("\n")
        )
      );
    }

    return types;
  });
}
