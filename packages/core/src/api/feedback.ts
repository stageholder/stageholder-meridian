import type { AxiosInstance } from "axios";
import type { Feedback } from "@repo/core/types";

export function createFeedbackApi(client: AxiosInstance) {
  return {
    create: async (data: {
      type: "general" | "bug" | "feature";
      message: string;
    }): Promise<{ success: boolean }> => {
      const res = await client.post("/feedback", data);
      return res.data;
    },
    list: async (params?: {
      page?: number;
      limit?: number;
    }): Promise<{
      data: Feedback[];
      total: number;
      page: number;
      limit: number;
    }> => {
      const res = await client.get("/feedback", { params });
      return res.data;
    },
  };
}

export type FeedbackApi = ReturnType<typeof createFeedbackApi>;
