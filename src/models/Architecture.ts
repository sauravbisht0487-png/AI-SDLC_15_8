import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComponent {
  name: string;
  type: "frontend" | "backend" | "database" | "external" | "queue" | "cache" | "other";
  responsibility: string;
  technology: string;
}

export interface IEntityField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface IRelationship {
  target: string; // name of another entity
  type: "one-to-one" | "one-to-many" | "many-to-many";
  description: string;
}

export interface IEntity {
  name: string;
  description: string;
  fields: IEntityField[];
  relationships: IRelationship[];
}

export interface IApiEndpoint {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description: string;
  authRequired: boolean;
  requestBody: string; // short JSON-shape description, "" if none
  responseBody: string;
}

export interface ITechChoice {
  area: string;
  choice: string;
  reason: string;
}

export interface IDesign {
  summary: string;
  components: IComponent[];
  entities: IEntity[];
  apiEndpoints: IApiEndpoint[];
  techChoices: ITechChoice[];
  dataFlow: string[]; // ordered steps
}

export interface IArchitecture extends Document {
  requirement: Types.ObjectId;
  project: Types.ObjectId;
  version: number;
  status: "draft" | "approved";
  design: IDesign;
  aiProvider: string;
  aiModel: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const s = (required = true) => ({ type: String, required, default: "" });

const componentSchema = new Schema<IComponent>(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["frontend", "backend", "database", "external", "queue", "cache", "other"],
      required: true,
    },
    responsibility: s(),
    technology: s(),
  },
  { _id: false },
);

const fieldSchema = new Schema<IEntityField>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    required: { type: Boolean, default: false },
    description: s(false),
  },
  { _id: false },
);

const relationshipSchema = new Schema<IRelationship>(
  {
    target: { type: String, required: true },
    type: { type: String, enum: ["one-to-one", "one-to-many", "many-to-many"], required: true },
    description: s(false),
  },
  { _id: false },
);

const entitySchema = new Schema<IEntity>(
  {
    name: { type: String, required: true },
    description: s(false),
    fields: { type: [fieldSchema], default: [] },
    relationships: { type: [relationshipSchema], default: [] },
  },
  { _id: false },
);

const endpointSchema = new Schema<IApiEndpoint>(
  {
    method: { type: String, enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], required: true },
    path: { type: String, required: true },
    description: s(false),
    authRequired: { type: Boolean, default: true },
    requestBody: s(false),
    responseBody: s(false),
  },
  { _id: false },
);

const techChoiceSchema = new Schema<ITechChoice>(
  {
    area: { type: String, required: true },
    choice: { type: String, required: true },
    reason: s(false),
  },
  { _id: false },
);

const designSchema = new Schema<IDesign>(
  {
    summary: s(),
    components: { type: [componentSchema], default: [] },
    entities: { type: [entitySchema], default: [] },
    apiEndpoints: { type: [endpointSchema], default: [] },
    techChoices: { type: [techChoiceSchema], default: [] },
    dataFlow: { type: [String], default: [] },
  },
  { _id: false },
);

const architectureSchema = new Schema<IArchitecture>(
  {
    requirement: { type: Schema.Types.ObjectId, ref: "Requirement", required: true },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    version: { type: Number, required: true },
    status: { type: String, enum: ["draft", "approved"], default: "draft" },
    design: { type: designSchema, required: true },
    aiProvider: { type: String, required: true },
    aiModel: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Serves "latest version for this requirement" and stops two requests
// from creating the same version number at the same time.
architectureSchema.index({ requirement: 1, version: -1 }, { unique: true });

export default mongoose.model<IArchitecture>("Architecture", architectureSchema);