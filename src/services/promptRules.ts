export const MOCKING_RULES = `Mocking rules (the sandbox runs a recent Vitest, where these matter):
- Anything the code calls with "new" (for example a Mongoose model) must be mocked with a "function" or a class, NEVER an arrow function. Arrow functions throw "is not a constructor".
- Mock a Mongoose model like this, adjusting the path so it is correct from the test file's own folder:
vi.mock("../src/models/Player", () => {
  const Player = vi.fn(function (this: Record<string, unknown>, data: Record<string, unknown>) {
    Object.assign(this, data);
    this.save = vi.fn().mockResolvedValue(this);
  });
  Object.assign(Player, { find: vi.fn(), findById: vi.fn(), findOne: vi.fn(), create: vi.fn() });
  return { default: Player };
});
- Import the mocked model normally in the test and set return values per test, for example: vi.mocked(Player.findById).mockResolvedValue(...).
- Call vi.clearAllMocks() in beforeEach.`;