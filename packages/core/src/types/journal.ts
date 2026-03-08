export interface Journal {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  mood?: number;
  tags: string[];
  authorId: string;
  date: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}
