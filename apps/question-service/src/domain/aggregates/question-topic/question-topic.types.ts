export interface CreateQuestionTopicProps {
  id: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
}

export interface UpdateQuestionTopicProps {
  name?: string;
  description?: string | null;
  parentId?: string | null;
}

export interface ReconstituteQuestionTopicProps {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  createdAt: Date;
}
