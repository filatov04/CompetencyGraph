export interface CommentInterface {
  id?: number;
  filename: string;
  startIndex: number;
  endIndex: number;
  subject: string;
  predicate: string;
  object: string;
  createdAt?: string;
  author?: string;
}

// Тип для создания нового комментария (без автогенерируемых полей)
export interface CreateCommentRequest {
  filename: string;
  startIndex: number;
  endIndex: number;
  subject: string;
  predicate: string;
  object: string;
}