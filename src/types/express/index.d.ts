export {};

import { IOrganization } from "../../models/Organization";
import { IProject } from "../../models/Project";
import { IRequirement } from "../../models/Requirement";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      organization?: IOrganization;
      project?: IProject;
      requirement?: IRequirement;
    }
  }
}