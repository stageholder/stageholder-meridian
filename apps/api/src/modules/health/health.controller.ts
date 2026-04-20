import { Controller, Get, Head, HttpCode } from "@nestjs/common";
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

  /**
   * PWA heartbeat uses HEAD for a cheap liveness probe. NestJS doesn't
   * auto-route HEAD onto the GET handler, and without a @Head handler
   * here the request falls through to the global AuthGuard and 401s —
   * which then makes the network-status indicator flap to "offline".
   */
  @Public()
  @Head()
  @HttpCode(200)
  headCheck(): void {
    // Intentionally empty — HEAD should return headers only, no body.
  }
}
