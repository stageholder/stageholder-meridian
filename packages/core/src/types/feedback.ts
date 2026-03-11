export interface Feedback {
  id: string;
  userId: string;
  type: "general" | "bug" | "feature";
  message: string;
  createdAt: string;
  updatedAt: string;
}
