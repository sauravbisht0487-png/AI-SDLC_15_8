import Organization, { IOrganization } from "../models/Organization";

export const create = async (name: string, ownerId: string): Promise<IOrganization> => {
  return Organization.create({ name, owner: ownerId });
};

export const findById = async (id: string): Promise<IOrganization | null> => {
  return Organization.findById(id);
};

export const findByOwner = async (ownerId: string): Promise<IOrganization[]> => {
  return Organization.find({ owner: ownerId });
};
export const updateById = async (
  id: string,
  updates: Partial<Pick<IOrganization, "name">>
): Promise<IOrganization | null> => {
  return Organization.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
};

export const deleteById = async (id: string): Promise<IOrganization | null> => {
  return Organization.findByIdAndDelete(id);
};