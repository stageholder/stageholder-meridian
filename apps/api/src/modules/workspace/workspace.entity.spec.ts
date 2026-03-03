import { describe, it, expect } from 'vitest';
import { Workspace } from './workspace.entity';

describe('Workspace Entity', () => {
  const validProps = {
    name: 'My Workspace',
    description: 'A test workspace',
    ownerId: 'owner-123',
  };

  describe('create()', () => {
    it('should create a workspace with valid props', () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('My Workspace');
        expect(result.value.slug).toBe('my-workspace');
        expect(result.value.description).toBe('A test workspace');
        expect(result.value.ownerId).toBe('owner-123');
        expect(result.value.id).toBeDefined();
      }
    });

    it('should auto-generate slug from name', () => {
      const result = Workspace.create({ ...validProps, name: 'Hello World Project' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.slug).toBe('hello-world-project');
      }
    });

    it('should create without description', () => {
      const result = Workspace.create({
        name: 'No Description',
        ownerId: 'owner-123',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.description).toBeUndefined();
      }
    });

    it('should fail with empty name', () => {
      const result = Workspace.create({ ...validProps, name: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Workspace name is required');
      }
    });

    it('should fail with whitespace-only name', () => {
      const result = Workspace.create({ ...validProps, name: '   ' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Workspace name is required');
      }
    });

    it('should fail with empty ownerId', () => {
      const result = Workspace.create({ ...validProps, ownerId: '' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('Owner is required');
      }
    });
  });

  describe('reconstitute()', () => {
    it('should reconstitute a workspace with all props and id', () => {
      const id = 'existing-ws-id';
      const props = {
        ...validProps,
        slug: 'my-workspace',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      const workspace = Workspace.reconstitute(props, id);
      expect(workspace.id).toBe(id);
      expect(workspace.name).toBe('My Workspace');
      expect(workspace.slug).toBe('my-workspace');
      expect(workspace.ownerId).toBe('owner-123');
      expect(workspace.createdAt).toEqual(new Date('2024-01-01'));
      expect(workspace.updatedAt).toEqual(new Date('2024-01-02'));
    });
  });

  describe('toObject()', () => {
    it('should return all properties including base entity fields', () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const obj = result.value.toObject();
        expect(obj.id).toBeDefined();
        expect(obj.name).toBe('My Workspace');
        expect(obj.slug).toBe('my-workspace');
        expect(obj.description).toBe('A test workspace');
        expect(obj.ownerId).toBe('owner-123');
        expect(obj.createdAt).toBeInstanceOf(Date);
        expect(obj.updatedAt).toBeInstanceOf(Date);
        expect(obj.deletedAt).toBeUndefined();
      }
    });
  });

  describe('Business methods', () => {
    it('should update name and regenerate slug', () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const workspace = result.value;
        workspace.updateName('New Workspace Name');
        expect(workspace.name).toBe('New Workspace Name');
        expect(workspace.slug).toBe('new-workspace-name');
      }
    });

    it('should update slug directly', () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const workspace = result.value;
        workspace.updateSlug('custom-slug');
        expect(workspace.slug).toBe('custom-slug');
      }
    });

    it('should update description and touch updatedAt', () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const workspace = result.value;
        const originalUpdatedAt = workspace.updatedAt;
        workspace.updateDescription('Updated description');
        expect(workspace.description).toBe('Updated description');
        expect(workspace.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
      }
    });
  });

  describe('generateSlug()', () => {
    it('should convert to lowercase', () => {
      expect(Workspace.generateSlug('HELLO')).toBe('hello');
    });

    it('should replace spaces with hyphens', () => {
      expect(Workspace.generateSlug('hello world')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(Workspace.generateSlug('hello@world!')).toBe('hello-world');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(Workspace.generateSlug('--hello--')).toBe('hello');
    });

    it('should handle multiple consecutive special characters', () => {
      expect(Workspace.generateSlug('a   b   c')).toBe('a-b-c');
    });
  });

  describe('softDelete() and restore()', () => {
    it('should soft delete a workspace', () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const workspace = result.value;
        expect(workspace.isDeleted).toBe(false);
        workspace.softDelete();
        expect(workspace.isDeleted).toBe(true);
        expect(workspace.deletedAt).toBeInstanceOf(Date);
      }
    });

    it('should restore a soft-deleted workspace', () => {
      const result = Workspace.create(validProps);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const workspace = result.value;
        workspace.softDelete();
        expect(workspace.isDeleted).toBe(true);
        workspace.restore();
        expect(workspace.isDeleted).toBe(false);
        expect(workspace.deletedAt).toBeUndefined();
      }
    });
  });

  describe('equals()', () => {
    it('should return true for entities with the same id', () => {
      const id = 'same-id';
      const ws1 = Workspace.reconstitute({ ...validProps, slug: 'my-workspace' }, id);
      const ws2 = Workspace.reconstitute({ ...validProps, slug: 'my-workspace', name: 'Different' }, id);
      expect(ws1.equals(ws2)).toBe(true);
    });

    it('should return false for entities with different ids', () => {
      const ws1 = Workspace.reconstitute({ ...validProps, slug: 'my-workspace' }, 'id-1');
      const ws2 = Workspace.reconstitute({ ...validProps, slug: 'my-workspace' }, 'id-2');
      expect(ws1.equals(ws2)).toBe(false);
    });

    it('should return false when compared with undefined', () => {
      const ws = Workspace.reconstitute({ ...validProps, slug: 'my-workspace' }, 'id-1');
      expect(ws.equals(undefined)).toBe(false);
    });
  });
});
