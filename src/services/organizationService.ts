import * as organizationRepository from "../repositories/organizationRepository";

export const createOrganization = async (name: string, ownerId: string) => {
  return organizationRepository.create(name, ownerId);
};

export const getUserOrganizations = async (ownerId: string) => {
  return organizationRepository.findByOwner(ownerId);
};
export const updateOrganization = async (id: string, updates: { name?: string }) => {
  return organizationRepository.updateById(id, updates);
};

export const deleteOrganization = async (id: string) => {
  return organizationRepository.deleteById(id);
};