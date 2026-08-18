import { pathToFileURL } from "node:url";

/** True when this module was invoked directly (`tsx path/to/script.ts`), not imported. */
export function isMain(moduleUrl: string): boolean {
  return process.argv[1]
    ? moduleUrl === pathToFileURL(process.argv[1]).href
    : false;
}
