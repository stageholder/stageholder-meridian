import { Entity, EntityProps, Ok, Err, Result } from '../../shared';

export interface WorkspaceProps extends EntityProps {
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
}

export class Workspace extends Entity<WorkspaceProps> {
  private constructor(props: WorkspaceProps, id?: string) { super(props, id); }

  get name(): string { return this.get('name'); }
  get slug(): string { return this.get('slug'); }
  get description(): string | undefined { return this.get('description'); }
  get ownerId(): string { return this.get('ownerId'); }

  updateName(name: string): void { this.set('name', name); this.set('slug', Workspace.generateSlug(name)); }
  updateSlug(slug: string): void { this.set('slug', slug); }
  updateDescription(description: string): void { this.set('description', description); }

  static generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  static create(props: Omit<WorkspaceProps, 'id' | 'createdAt' | 'updatedAt' | 'slug'>): Result<Workspace> {
    if (!props.name || props.name.trim().length === 0) return Err(new Error('Workspace name is required'));
    if (!props.ownerId) return Err(new Error('Owner is required'));
    const slug = Workspace.generateSlug(props.name);
    return Ok(new Workspace({ ...props, slug } as WorkspaceProps));
  }

  static reconstitute(props: WorkspaceProps, id: string): Workspace { return new Workspace(props, id); }
}
