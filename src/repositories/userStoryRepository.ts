import UserStory, { IUserStory } from "../models/UserStory";

export const create = async (
  title: string,
  description: string,
  acceptanceCriteria: string[],
  requirementId: string,
  createdBy: string
): Promise<IUserStory> => {
  return UserStory.create({
    title,
    description,
    acceptanceCriteria,
    requirement: requirementId,
    createdBy,
  });
};

export const findById = async (id: string): Promise<IUserStory | null> => {
  return UserStory.findById(id);
};

export const findByRequirement = async (requirementId: string): Promise<IUserStory[]> => {
  return UserStory.find({ requirement: requirementId });
};
export const updateById = async (
  id: string,
  updates: Partial<Pick<IUserStory, "title" | "description" | "acceptanceCriteria">>
): Promise<IUserStory | null> => {
  return UserStory.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
};

export const deleteById = async (id: string): Promise<IUserStory | null> => {
  return UserStory.findByIdAndDelete(id);
};