import { Controller, Get } from "@nestjs/common";
import {
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
  HealthCheck,
} from "@nestjs/terminus";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private mongoose: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck("mongodb"),
      () => this.memory.checkHeap("memory_heap", 256 * 1024 * 1024),
    ]);
  }
}
