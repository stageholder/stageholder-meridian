export interface Journal {
  id: string;
  userSub: string;
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

export interface JournalStatDay {
  date: string;
  count: number;
  words: number;
}

export interface JournalStats {
  baseline: {
    totalCount: number;
    totalWords: number;
  };
  days: JournalStatDay[];
}
