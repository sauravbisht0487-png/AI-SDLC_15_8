import type { JsonSchema } from "./AIProvider";
import type { IDesign } from "../models/Architecture";
import { aiError } from "./errors";

// ---------- schema sent to the AI ----------
const str: JsonSchema = { type: "string" };
const bool: JsonSchema = { type: "boolean" };
const arr = (items: JsonSchema): JsonSchema => ({ type: "array", items });
// Strict mode needs every property listed in `required`.
const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const designJsonSchema: JsonSchema = obj({
  summary: str,
  components: arr(obj({ name: str, type: str, responsibility: str, technology: str })),
  entities: arr(
    obj({
      name: str,
      description: str,
      fields: arr(obj({ name: str, type: str, required: bool, description: str })),
      relationships: arr(obj({ target: str, type: str, description: str })),
    }),
  ),
  apiEndpoints: arr(
    obj({
      method: str,
      path: str,
      description: str,
      authRequired: bool,
      requestBody: str,
      responseBody: str,
    }),
  ),
  techChoices: arr(obj({ area: str, choice: str, reason: str })),
  dataFlow: arr(str),
});

// ---------- validation of what the AI returned ----------
type Rec = Record<string, unknown>;

const COMPONENT_TYPES = ["frontend", "backend", "database", "external", "queue", "cache", "other"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const REL_TYPES = ["one-to-one", "one-to-many", "many-to-many"];

const MAX_COMPONENTS = 12;
const MAX_ENTITIES = 15;
const MAX_ENDPOINTS = 40;
const MAX_TECH = 15;
const MAX_FLOW = 20;
const MAX_FIELDS = 30;

const fail = (message: string) => aiError("AI_INVALID_SHAPE", message);

const asRec = (v: unknown): Rec | null =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : null;

const reqStr = (o: Rec, key: string, where: string): string => {
  const v = o[key];
  if (typeof v !== "string" || !v.trim()) throw fail(`${where}.${key} must be a non-empty string`);
  return v.trim();
};

const optStr = (o: Rec, key: string): string => {
  const v = o[key];
  return typeof v === "string" ? v.trim() : "";
};

const mapList = <T>(o: Rec, key: string, max: number, fn: (item: Rec, where: string) => T): T[] => {
  const v = o[key];
  if (!Array.isArray(v)) throw fail(`${key} must be an array`);
  return v.slice(0, max).map((item, i) => {
    const rec = asRec(item);
    if (!rec) throw fail(`${key}[${i}] is not an object`);
    return fn(rec, `${key}[${i}]`);
  });
};

export const parseDesign = (raw: unknown): IDesign => {
  const root = asRec(raw);
  if (!root) throw fail("Design response was not a JSON object");

  const components = mapList(root, "components", MAX_COMPONENTS, (c, w) => {
    const type = reqStr(c, "type", w).toLowerCase();
    return {
      name: reqStr(c, "name", w),
      type: (COMPONENT_TYPES.includes(type) ? type : "other") as IDesign["components"][number]["type"],
      responsibility: optStr(c, "responsibility"),
      technology: optStr(c, "technology"),
    };
  });

  const entities = mapList(root, "entities", MAX_ENTITIES, (e, w) => ({
    name: reqStr(e, "name", w),
    description: optStr(e, "description"),
    fields: mapList(e, "fields", MAX_FIELDS, (f, fw) => ({
      name: reqStr(f, "name", `${w}.${fw}`),
      type: reqStr(f, "type", `${w}.${fw}`),
      required: f["required"] === true,
      description: optStr(f, "description"),
    })),
    relationships: mapList(e, "relationships", MAX_ENTITIES, (r, rw) => {
      const type = reqStr(r, "type", `${w}.${rw}`).toLowerCase();
      if (!REL_TYPES.includes(type)) throw fail(`${w}.${rw}.type "${type}" is invalid`);
      return {
        target: reqStr(r, "target", `${w}.${rw}`),
        type: type as IDesign["entities"][number]["relationships"][number]["type"],
        description: optStr(r, "description"),
      };
    }),
  }));

  const apiEndpoints = mapList(root, "apiEndpoints", MAX_ENDPOINTS, (a, w) => {
    const method = reqStr(a, "method", w).toUpperCase();
    if (!METHODS.includes(method)) throw fail(`${w}.method "${method}" is invalid`);
    const path = reqStr(a, "path", w);
    if (!path.startsWith("/")) throw fail(`${w}.path must start with "/"`);
    return {
      method: method as IDesign["apiEndpoints"][number]["method"],
      path,
      description: optStr(a, "description"),
      authRequired: a["authRequired"] !== false,
      requestBody: optStr(a, "requestBody"),
      responseBody: optStr(a, "responseBody"),
    };
  });

  const techChoices = mapList(root, "techChoices", MAX_TECH, (t, w) => ({
    area: reqStr(t, "area", w),
    choice: reqStr(t, "choice", w),
    reason: optStr(t, "reason"),
  }));

  const flow = root["dataFlow"];
  if (!Array.isArray(flow)) throw fail("dataFlow must be an array");
  const dataFlow = flow
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, MAX_FLOW);

  if (components.length === 0) throw fail("Design has no components");

  return { summary: optStr(root, "summary"), components, entities, apiEndpoints, techChoices, dataFlow };
};