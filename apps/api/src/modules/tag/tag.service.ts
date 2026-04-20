import { Injectable, NotFoundException } from "@nestjs/common";
import { TagRepository } from "./tag.repository";
import { Tag } from "./tag.entity";
import { CreateTagDto, UpdateTagDto } from "./tag.dto";
import {
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../../shared";

@Injectable()
export class TagService {
  constructor(private readonly repository: TagRepository) {}

  async create(userSub: string, dto: CreateTagDto): Promise<Tag> {
    const result = Tag.create({
      name: dto.name,
      color: dto.color,
      userSub,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    return result.value;
  }

  async findByUser(userSub: string): Promise<Tag[]> {
    return this.repository.findByUser(userSub);
  }

  async listByUser(userSub: string, page?: number, limit?: number) {
    const p = Math.max(page || DEFAULT_PAGE, 1);
    const l = Math.min(Math.max(limit || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { docs, total } = await this.repository.findByUserPaginated(
      userSub,
      p,
      l,
    );
    return {
      data: docs.map((d) => d.toObject()),
      meta: buildPaginationMeta(total, p, l),
    };
  }

  async findUpdatedSince(
    userSub: string,
    since: string,
    includeSoftDeleted = false,
  ): Promise<Tag[]> {
    return this.repository.findUpdatedSince(userSub, since, includeSoftDeleted);
  }

  async findById(userSub: string, id: string): Promise<Tag> {
    const tag = await this.repository.findById(userSub, id);
    if (!tag) throw new NotFoundException("Tag not found");
    return tag;
  }

  async update(userSub: string, id: string, dto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findById(userSub, id);
    if (dto.name) tag.updateName(dto.name);
    if (dto.color) tag.updateColor(dto.color);
    await this.repository.save(tag);
    return tag;
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.findById(userSub, id);
    await this.repository.delete(userSub, id);
  }

  // Purge every tag for the user. Used by the Hub user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }
}
