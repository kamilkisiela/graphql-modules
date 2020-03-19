import { noop } from "@graphql-modules/core";

test("basic", () => {
  expect(noop()).toBe(true);
});
