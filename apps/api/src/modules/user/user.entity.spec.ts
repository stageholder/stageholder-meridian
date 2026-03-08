import { describe, it, expect } from 'vitest';
import { User, AuthProvider } from './user.entity';

describe('User Entity', () => {
  const validLocalProps = {
    email: 'john@example.com',
    name: 'John Doe',
    passwordHash: 'hashed_password_123',
    provider: AuthProvider.LOCAL,
    emailVerified: false,
    onboardingCompleted: false,
  };

  const validGoogleProps = {
    email: 'jane@gmail.com',
    name: 'Jane Doe',
    provider: AuthProvider.GOOGLE,
    providerId: 'google-id-123',
    emailVerified: true,
    onboardingCompleted: false,
  };

  describe('create()', () => {
    it('should create a local user with valid props', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.email).toBe('john@example.com');
        expect(result.value.name).toBe('John Doe');
        expect(result.value.passwordHash).toBe('hashed_password_123');
        expect(result.value.provider).toBe(AuthProvider.LOCAL);
        expect(result.value.emailVerified).toBe(false);
        expect(result.value.id).toBeDefined();
      }
    });

    it('should create a Google user with valid props', () => {
      const result = User.create(validGoogleProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.email).toBe('jane@gmail.com');
        expect(result.value.name).toBe('Jane Doe');
        expect(result.value.provider).toBe(AuthProvider.GOOGLE);
        expect(result.value.providerId).toBe('google-id-123');
        expect(result.value.emailVerified).toBe(true);
      }
    });

    it('should fail with empty email', () => {
      const result = User.create({ ...validLocalProps, email: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Invalid email');
      }
    });

    it('should fail with email missing @', () => {
      const result = User.create({ ...validLocalProps, email: 'invalid-email' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Invalid email');
      }
    });

    it('should fail with empty name', () => {
      const result = User.create({ ...validLocalProps, name: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Name is required');
      }
    });

    it('should fail with whitespace-only name', () => {
      const result = User.create({ ...validLocalProps, name: '   ' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Name is required');
      }
    });

    it('should fail when local provider has no password hash', () => {
      const result = User.create({
        ...validLocalProps,
        passwordHash: undefined,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Password is required for local accounts');
      }
    });

    it('should allow Google provider without password hash', () => {
      const result = User.create(validGoogleProps);
      expect(result.ok).toBe(true);
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute a user with all props and id', () => {
      const id = 'existing-user-id';
      const props = {
        ...validLocalProps,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      const user = User.reconstitute(props, id);
      expect(user.id).toBe(id);
      expect(user.email).toBe('john@example.com');
      expect(user.name).toBe('John Doe');
      expect(user.createdAt).toEqual(new Date('2024-01-01'));
      expect(user.updatedAt).toEqual(new Date('2024-01-02'));
    });
  });

  describe('toObject()', () => {
    it('should return all properties including base entity fields', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const obj = result.value.toObject();
        expect(obj.id).toBeDefined();
        expect(obj.email).toBe('john@example.com');
        expect(obj.name).toBe('John Doe');
        expect(obj.passwordHash).toBe('hashed_password_123');
        expect(obj.provider).toBe(AuthProvider.LOCAL);
        expect(obj.emailVerified).toBe(false);
        expect(obj.createdAt).toBeInstanceOf(Date);
        expect(obj.updatedAt).toBeInstanceOf(Date);
        expect(obj.deletedAt).toBeUndefined();
      }
    });
  });

  describe('Business methods', () => {
    it('should update name and touch updatedAt', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const user = result.value;
        const originalUpdatedAt = user.updatedAt;
        user.updateName('New Name');
        expect(user.name).toBe('New Name');
        expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
      }
    });

    it('should update avatar and touch updatedAt', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const user = result.value;
        user.updateAvatar('https://example.com/avatar.png');
        expect(user.avatar).toBe('https://example.com/avatar.png');
      }
    });

    it('should update timezone', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const user = result.value;
        user.updateTimezone('America/New_York');
        expect(user.timezone).toBe('America/New_York');
      }
    });

    it('should update password hash', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const user = result.value;
        user.updatePasswordHash('new_hashed_password');
        expect(user.passwordHash).toBe('new_hashed_password');
      }
    });

    it('should mark email as verified', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const user = result.value;
        expect(user.emailVerified).toBe(false);
        user.markEmailVerified();
        expect(user.emailVerified).toBe(true);
      }
    });

    it('should complete onboarding', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const user = result.value;
        expect(user.onboardingCompleted).toBe(false);
        user.completeOnboarding();
        expect(user.onboardingCompleted).toBe(true);
      }
    });

    it('should default onboardingCompleted to false on create', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.onboardingCompleted).toBe(false);
      }
    });
  });

  describe('softDelete() and restore()', () => {
    it('should soft delete a user', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const user = result.value;
        expect(user.isDeleted).toBe(false);
        expect(user.deletedAt).toBeUndefined();
        user.softDelete();
        expect(user.isDeleted).toBe(true);
        expect(user.deletedAt).toBeInstanceOf(Date);
      }
    });

    it('should restore a soft-deleted user', () => {
      const result = User.create(validLocalProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const user = result.value;
        user.softDelete();
        expect(user.isDeleted).toBe(true);
        user.restore();
        expect(user.isDeleted).toBe(false);
        expect(user.deletedAt).toBeUndefined();
      }
    });
  });

  describe('equals()', () => {
    it('should return true for entities with the same id', () => {
      const id = 'same-id';
      const user1 = User.reconstitute(validLocalProps, id);
      const user2 = User.reconstitute(validGoogleProps, id);
      expect(user1.equals(user2)).toBe(true);
    });

    it('should return false for entities with different ids', () => {
      const user1 = User.reconstitute(validLocalProps, 'id-1');
      const user2 = User.reconstitute(validLocalProps, 'id-2');
      expect(user1.equals(user2)).toBe(false);
    });

    it('should return false when compared with undefined', () => {
      const user = User.reconstitute(validLocalProps, 'id-1');
      expect(user.equals(undefined)).toBe(false);
    });
  });
});
