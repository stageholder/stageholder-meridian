/**
 * Single Source of Truth for instantiating the framework-agnostic
 * `@repo/core/api/*` factories. The hooks (`lib/api/*.ts`) import the
 * *instances* from here instead of constructing factories or calling
 * `apiClient.get/post/...` inline with hand-rolled paths and response
 * unwrapping.
 *
 * Mirror this file in `apps/mobile/src/lib/api/clients.ts` with mobile's
 * `apiClient` — the only difference between the two apps is the underlying
 * client that gets passed into the factories.
 */
import apiClient from "@/lib/api-client";
import { createHabitsApi } from "@repo/core/api/habits";
import { createTodosApi } from "@repo/core/api/todos";
import { createJournalsApi } from "@repo/core/api/journals";
import { createLightApi } from "@repo/core/api/light";
import { createTagsApi } from "@repo/core/api/tags";
import { createNotificationsApi } from "@repo/core/api/notifications";
import { createActivitiesApi } from "@repo/core/api/activities";
import { createFeedbackApi } from "@repo/core/api/feedback";

export const habitsApi = createHabitsApi(apiClient);
export const todosApi = createTodosApi(apiClient);
export const journalsApi = createJournalsApi(apiClient);
export const lightApi = createLightApi(apiClient);
export const tagsApi = createTagsApi(apiClient);
export const notificationsApi = createNotificationsApi(apiClient);
export const activitiesApi = createActivitiesApi(apiClient);
export const feedbackApi = createFeedbackApi(apiClient);
