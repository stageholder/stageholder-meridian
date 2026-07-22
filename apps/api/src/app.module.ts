import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "crypto";
import {
  StageholderAuthModule,
  StageholderAuthGuard,
  StageholderWebhookModule,
} from "@stageholder/sdk/nestjs";
import { MongoWebhookDedupeStore } from "./modules/hub-webhook/webhook-dedupe.store";
import { MongoWebhookDeliveryStore } from "./modules/hub-webhook/webhook-delivery.store";
import {
  WebhookDeliveryLog,
  WebhookDeliveryLogSchema,
  WebhookDedupeMark,
  WebhookDedupeMarkSchema,
} from "./modules/hub-webhook/webhook-store.schema";
import { TagModule } from "./modules/tag/tag.module";
import { TodoListModule } from "./modules/todo-list/todo-list.module";
import { TodoModule } from "./modules/todo/todo.module";
import { JournalModule } from "./modules/journal/journal.module";
import { HabitModule } from "./modules/habit/habit.module";
import { HabitEntryModule } from "./modules/habit-entry/habit-entry.module";
import { ActivityModule } from "./modules/activity/activity.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { CalendarModule } from "./modules/calendar/calendar.module";
import { LightModule } from "./modules/light/light.module";
import { FeedbackModule } from "./modules/feedback/feedback.module";
import { HealthModule } from "./modules/health/health.module";
import { EncryptionModule } from "./modules/encryption";
import { JournalSecurityModule } from "./modules/journal-security/journal-security.module";
import { MeModule } from "./modules/me/me.module";
import { UserModule } from "./modules/user/user.module";
import { HabitGroupModule } from "./modules/habit-group/habit-group.module";
import { HubWebhookModule } from "./modules/hub-webhook/hub-webhook.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EncryptionModule,
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req: any) => req.headers["x-request-id"] || randomUUID(),
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  singleLine: true,
                  ignore: "pid,hostname",
                },
              }
            : undefined,
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        autoLogging: true,
        serializers: {
          req: (req: any) => ({ method: req.method, url: req.url }),
          res: (res: any) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>("MONGODB_URI"),
      }),
    }),
    // Reads canonical env vars (IDENTITY_ISSUER_URL, IDENTITY_CLIENT_ID,
    // IDENTITY_CLIENT_SECRET, IDENTITY_TOKEN_AUDIENCE, STAGEHOLDER_AUTH_DEBUG).
    // Validates synchronously at boot — misconfigured env throws ConfigError
    // before any request is handled.
    StageholderAuthModule.fromEnv(),
    // Hub-emitted outbound webhooks. Secret is generated once when the admin
    // registers Meridian's endpoint in Hub's `/admin/webhook-endpoints` UI;
    // copy it into the env. Without it the guard refuses every request.
    //
    // `forRootAsync` (not `forRoot`) so the SDK's `WebhookDispatcher` gets
    // DURABLE, replica-shared stores instead of its in-memory defaults:
    //   - dedupe (idempotency) → Mongo `webhook_dedupe` (TTL'd), so a Svix
    //     redelivery is skipped across all API instances.
    //   - deliveryStore (audit log) → Mongo `webhook_deliveries`, powering the
    //     operator console's delivery inspector + replay.
    // The `imports` supply the models the store classes inject. No `controller`
    // option — Meridian mounts its own `@Public()` receiver (HubWebhookModule)
    // because `StageholderAuthGuard` is a global `APP_GUARD` and the SDK's
    // built-in controller has no public-route escape.
    StageholderWebhookModule.forRootAsync({
      secret: process.env.STAGEHOLDER_WEBHOOK_SECRET ?? "",
      imports: [
        MongooseModule.forFeature([
          { name: WebhookDeliveryLog.name, schema: WebhookDeliveryLogSchema },
          { name: WebhookDedupeMark.name, schema: WebhookDedupeMarkSchema },
        ]),
      ],
      dedupe: { useClass: MongoWebhookDedupeStore },
      deliveryStore: { useClass: MongoWebhookDeliveryStore },
    }),
    TagModule,
    TodoListModule,
    TodoModule,
    JournalModule,
    HabitModule,
    HabitGroupModule,
    HabitEntryModule,
    ActivityModule,
    NotificationModule,
    CalendarModule,
    LightModule,
    FeedbackModule,
    HealthModule,
    JournalSecurityModule,
    MeModule,
    UserModule,
    HubWebhookModule,
  ],
  providers: [
    // Explicit factory injection — Nest looks up the SDK-provided
    // StageholderAuthGuard singleton (from the global StageholderAuthModule)
    // and aliases it as APP_GUARD. `useExisting` and `useClass` both fail
    // here because of how Nest resolves cross-module DI scopes for symbol
    // tokens like STAGEHOLDER_AUTH_CONFIG.
    {
      provide: APP_GUARD,
      useFactory: (guard: StageholderAuthGuard) => guard,
      inject: [StageholderAuthGuard],
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
