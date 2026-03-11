import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { FeedbackService } from "./feedback.service";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

const CreateFeedbackDto = z.object({
  type: z.enum(["general", "bug", "feature"]),
  message: z.string().min(1, "Message is required").max(5000),
});
type CreateFeedbackDto = z.infer<typeof CreateFeedbackDto>;

@ApiTags("Feedback")
@Controller("feedback")
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @Get()
  async list(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.service.list(
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(CreateFeedbackDto)) body: CreateFeedbackDto,
  ) {
    await this.service.create(userId, body.type, body.message);
    return { success: true };
  }
}
