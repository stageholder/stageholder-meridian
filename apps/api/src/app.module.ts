import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "crypto";
import { StageholderAuthModule } from "@stageholder/auth";
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
import { HubEventsModule } from "./modules/hub-events/hub-events.module";
import { AuthGuard } from "./common/guards/auth.guard";

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
    StageholderAuthModule.forRoot({
      issuerUrl: process.env.IDENTITY_ISSUER_URL!,
      clientId: process.env.IDENTITY_CLIENT_ID!,
      clientSecret: process.env.IDENTITY_CLIENT_SECRET!,
      // Must match whatever `aud` claim the Hub puts on access tokens.
      // Hub's oidc-provider resourceIndicators config decides this. If
      // that config sets `defaultResource: () => "urn:stageholder:api"`,
      // this must be the exact same string. Override via env so the Hub
      // can change its resource identifier without requiring a redeploy
      // of every product.
      audience: process.env.IDENTITY_TOKEN_AUDIENCE ?? "urn:stageholder:api",
    }),
    TagModule,
    TodoListModule,
    TodoModule,
    JournalModule,
    HabitModule,
    HabitEntryModule,
    ActivityModule,
    NotificationModule,
    CalendarModule,
    LightModule,
    FeedbackModule,
    HealthModule,
    JournalSecurityModule,
    MeModule,
    HubEventsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
