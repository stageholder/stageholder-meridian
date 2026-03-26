export interface Journal {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  mood?: number;
  tags: string[] | string;
  authorId: string;
  date: string;
  wordCount: number;
  encrypted?: boolean;
  createdAt: string;
  updatedAt: string;
}
