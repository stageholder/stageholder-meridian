import { generateId } from './id.utils';

export interface EntityProps {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export abstract class Entity<T extends EntityProps> {
  protected readonly props: T;
  private readonly _id: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _deletedAt: Date | undefined;

  protected constructor(props: T, id?: string) {
    this._id = id || props.id || generateId();
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
    this._deletedAt = props.deletedAt;
    this.props = { ...props, id: this._id };
  }

  get id(): string { return this._id; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get deletedAt(): Date | undefined { return this._deletedAt; }
  get isDeleted(): boolean { return !!this._deletedAt; }

  protected touch(): void { this._updatedAt = new Date(); }

  softDelete(): void { this._deletedAt = new Date(); this.touch(); }
  restore(): void { this._deletedAt = undefined; this.touch(); }

  public equals(entity?: Entity<T>): boolean {
    if (!entity) return false;
    if (!(entity instanceof Entity)) return false;
    return this._id === entity._id;
  }

  protected get<K extends keyof T>(key: K): T[K] { return this.props[key]; }

  protected set<K extends keyof T>(key: K, value: T[K]): void {
    this.props[key] = value;
    this.touch();
  }

  public toObject(): T & { id: string; createdAt: Date; updatedAt: Date; deletedAt?: Date } {
    return {
      ...this.props,
      id: this._id,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      deletedAt: this._deletedAt,
    };
  }
}
