import { IOrganization } from "../models/Organization";
import * as organizationRepository from "../repositories/organizationRepository";

export const verifyOrgOwnership = async (
  orgId: string,
  userId: string
): Promise<{ organization: IOrganization } | { error: { status: number; message: string } }> => {
  const organization = await organizationRepository.findById(orgId);

  if (!organization) {
    return { error: { status: 404, message: "Organization not found" } };
  }
  if (organization.owner.toString() !== userId) {
    return { error: { status: 403, message: "Not authorized to access this organization" } };
  }

  return { organization };
};