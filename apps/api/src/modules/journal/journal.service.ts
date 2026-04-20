import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { JournalRepository } from "./journal.repository";
import { Journal } from "./journal.entity";
import { CreateJournalDto, UpdateJournalDto } from "./journal.dto";
import { LightService } from "../light/light.service";
import {
  PaginatedResult,
  buildPaginationMeta,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../../shared";

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(
    private readonly repository: JournalRepository,
    private readonly lightService: LightService,
  ) {}

  async create(userSub: string, dto: CreateJournalDto): Promise<Journal> {
    const result = Journal.create({
      title: dto.title,
      content: dto.content,
      mood: dto.mood,
      tags: dto.tags || [],
      userSub,
      date: dto.date,
      encrypted: dto.encrypted,
      wordCount: dto.wordCount,
    });
    if (!result.ok) throw result.error;
    await this.repository.save(result.value);
    this.lightService
      .awardJournalEntry(userSub, result.value.id)
      .catch((err) =>
        this.logger.warn("Failed to award light for journal entry", err),
      );
    return result.value;
  }

  async findById(userSub: string, id: string): Promise<Journal> {
    const journal = await this.repository.findById(userSub, id);
    if (!journal) throw new NotFoundException("Journal not found");
    return journal;
  }

  async listByUser(
    userSub: string,
    startDate?: string,
    endDate?: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResult<ReturnType<Journal["toObject"]>>> {
    if (startDate && endDate) {
      const journals = await this.repository.findByDateRange(
        userSub,
        startDate,
        endDate,
      );
      return {
        data: journals.map((j) => j.toObject()),
        meta: buildPaginationMeta(journals.length, 1, journals.length || 1),
      };
    }
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
    includeSoftDeleted: boolean,
  ) {
    const journals = await this.repository.findUpdatedSince(
      userSub,
      since,
      includeSoftDeleted,
    );
    return journals.map((j) => j.toObject());
  }

  async update(
    userSub: string,
    id: string,
    dto: UpdateJournalDto,
  ): Promise<Journal> {
    const journal = await this.findById(userSub, id);
    if (dto.title) journal.updateTitle(dto.title);
    if (dto.content !== undefined) journal.updateContent(dto.content);
    if (dto.mood !== undefined) journal.updateMood(dto.mood ?? undefined);
    if (dto.tags !== undefined) journal.updateTags(dto.tags);
    if (dto.date) journal.updateDate(dto.date);
    if (dto.wordCount !== undefined) journal.updateWordCount(dto.wordCount);
    await this.repository.save(journal);
    return journal;
  }

  async getStats(userSub: string, clientToday?: string) {
    const todayStr =
      clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday)
        ? clientToday
        : new Date().toISOString().slice(0, 10);
    const today = new Date(todayStr + "T00:00:00Z");
    const windowStartDate = new Date(today);
    windowStartDate.setUTCDate(windowStartDate.getUTCDate() - 29);
    const windowStart = windowStartDate.toISOString().slice(0, 10);

    const { window, baseline } = await this.repository.getGrowthStats(
      userSub,
      windowStart,
    );

    const dayMap = new Map(window.map((d) => [d.date, d]));
    const days: Array<{ date: string; count: number; words: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const day = dayMap.get(dateStr);
      days.push({
        date: dateStr,
        count: day?.count ?? 0,
        words: day?.words ?? 0,
      });
    }

    return {
      baseline: {
        totalCount: baseline.count,
        totalWords: baseline.words,
      },
      days,
    };
  }

  async delete(userSub: string, id: string): Promise<void> {
    await this.findById(userSub, id);
    await this.repository.delete(userSub, id);
  }

  // Purge every journal for the user. Used by the Hub user.deleted cascade.
  async deleteAllForUser(userSub: string): Promise<number> {
    return this.repository.deleteAllForUser(userSub);
  }
}
