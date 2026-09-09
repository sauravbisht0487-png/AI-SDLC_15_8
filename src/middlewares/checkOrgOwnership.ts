import { Request, Response, NextFunction } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { verifyOrgOwnership } from "../utils/ownership";

interface OrgParams extends ParamsDictionary {
  orgId: string;
}

export const checkOrgOwnership = async (
  req: Request<OrgParams>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { orgId } = req.params;
    const userId = req.userId!;

    const result = await verifyOrgOwnership(orgId, userId);
    if ("error" in result) {
      res.status(result.error.status).json({ message: result.error.message });
      return;
    }

    req.organization = result.organization;
    next();
  } catch (error) {
    res.status(500).json({ message: "Server error checking authorization" });
  }
};