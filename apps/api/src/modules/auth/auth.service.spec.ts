import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { User, AuthProvider } from "../user/user.entity";

function makeUser(overrides: Partial<Record<string, unknown>> = {}): User {
  const result = User.create({
    email: (overrides.email as string) ?? "test@example.com",
    name: (overrides.name as string) ?? "Test User",
    passwordHash: (overrides.passwordHash as string) ?? "$2a$12$hashedpassword",
    provider: (overrides.provider as AuthProvider) ?? AuthProvider.LOCAL,
    emailVerified: false,
  });
  if (!result.ok) throw new Error("Failed to create test user");
  return result.value;
}

function makeWorkspace() {
  return { id: "ws-1", shortId: "abc123" };
}

const mockUserService = {
  createLocal: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
  updateUser: vi.fn(),
  findOrCreateGoogle: vi.fn(),
};

const mockWorkspaceService = {
  createPersonal: vi.fn(),
  findPersonalByOwner: vi.fn(),
};

const mockConfigService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
};

const mockUserModel = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfigService.getOrThrow.mockReturnValue("test-jwt-secret");
    mockConfigService.get.mockImplementation(
      (key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          JWT_EXPIRES_IN: "15m",
          REFRESH_TOKEN_EXPIRES_IN: "7",
          GOOGLE_CLIENT_ID: "google-id",
          FRONTEND_URL: "http://localhost:3000",
        };
        return map[key] ?? defaultVal;
      },
    );

    service = new AuthService(
      mockUserService as any,
      mockWorkspaceService as any,
      mockConfigService as any,
      mockUserModel as any,
    );
  });

  describe("register", () => {
    it("should register a new user and return tokens and workspace", async () => {
      const user = makeUser();
      const ws = makeWorkspace();
      mockUserService.createLocal.mockResolvedValue(user);
      mockWorkspaceService.createPersonal.mockResolvedValue(ws);
      mockUserModel.updateOne.mockResolvedValue(undefined);

      const result = await service.register({
        email: "test@example.com",
        name: "Test User",
        password: "password123",
      });

      expect(result.user).toBe(user);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.personalWorkspaceShortId).toBe("abc123");
      expect(mockUserService.createLocal).toHaveBeenCalledOnce();
      expect(mockWorkspaceService.createPersonal).toHaveBeenCalledOnce();
    });
  });

  describe("login", () => {
    it("should throw UnauthorizedException if user not found", async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: "nobody@example.com", password: "pass" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if user has no password hash", async () => {
      const googleUser = makeUser({ provider: AuthProvider.GOOGLE });
      // Simulate a Google user with no passwordHash by overriding
      vi.spyOn(googleUser, "passwordHash", "get").mockReturnValue(undefined);
      mockUserService.findByEmail.mockResolvedValue(googleUser);

      await expect(
        service.login({ email: "test@example.com", password: "pass" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for wrong password", async () => {
      const user = makeUser();
      mockUserService.findByEmail.mockResolvedValue(user);
      // bcrypt.compare will fail since the hash is fake
      await expect(
        service.login({ email: "test@example.com", password: "wrongpassword" }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("refreshToken", () => {
    it("should throw UnauthorizedException for invalid refresh token", async () => {
      mockUserModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      await expect(service.refreshToken("bad-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user not found after token lookup", async () => {
      mockUserModel.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: "user-gone" }),
      });
      mockUserService.findById.mockResolvedValue(null);

      await expect(service.refreshToken("some-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("getProfile", () => {
    it("should return the user for a valid userId", async () => {
      const user = makeUser();
      mockUserService.findById.mockResolvedValue(user);

      const result = await service.getProfile(user.id);
      expect(result).toBe(user);
    });

    it("should throw UnauthorizedException if user not found", async () => {
      mockUserService.findById.mockResolvedValue(null);

      await expect(service.getProfile("missing")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("updateProfile", () => {
    it("should update user name and save", async () => {
      const user = makeUser();
      mockUserService.findById.mockResolvedValue(user);
      mockUserService.updateUser.mockResolvedValue(undefined);

      const result = await service.updateProfile(user.id, { name: "New Name" });

      expect(result.name).toBe("New Name");
      expect(mockUserService.updateUser).toHaveBeenCalledOnce();
    });

    it("should update timezone", async () => {
      const user = makeUser();
      mockUserService.findById.mockResolvedValue(user);
      mockUserService.updateUser.mockResolvedValue(undefined);

      const result = await service.updateProfile(user.id, {
        timezone: "Asia/Jakarta",
      });

      expect(result.timezone).toBe("Asia/Jakarta");
    });
  });

  describe("completeOnboarding", () => {
    it("should mark onboarding complete and return workspace shortId", async () => {
      const user = makeUser();
      const ws = makeWorkspace();
      mockUserService.findById.mockResolvedValue(user);
      mockUserService.updateUser.mockResolvedValue(undefined);
      mockWorkspaceService.findPersonalByOwner.mockResolvedValue(ws);

      const result = await service.completeOnboarding(user.id);

      expect(result.user.onboardingCompleted).toBe(true);
      expect(result.personalWorkspaceShortId).toBe("abc123");
    });
  });

  describe("logout", () => {
    it("should clear the refresh token hash", async () => {
      mockUserModel.updateOne.mockResolvedValue(undefined);

      await service.logout("user-1");

      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: "user-1" },
        { $unset: { refresh_token_hash: 1 } },
      );
    });
  });
});
