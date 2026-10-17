import { Controller, Get, Post, Body, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { FeedbackService } from "./feedback.service";
import { StageholderRequest } from "../../common/types";
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

  /** The caller's OWN feedback only (it used to list every user's). */
  @Get()
  async list(
    @Req() req: StageholderRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.list(
      req.user.sub,
      page ? +page : undefined,
      limit ? +limit : undefined,
    );
  }

  @Post()
  async create(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(CreateFeedbackDto)) body: CreateFeedbackDto,
  ) {
    await this.service.create(req.user.sub, body.type, body.message);
    return { success: true };
  }
}
