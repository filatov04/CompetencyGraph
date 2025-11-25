import { api } from './customAxiosInstance';
import type { CommentInterface, CreateCommentRequest } from '../types/markupTypes';

/**
 * Получить комментарии для указанного файла
 * @param filename - имя файла (хеш или идентификатор)
 * @param limit - максимальное количество комментариев (по умолчанию 20)
 */
const getMarkup = async (filename: string, limit: number = 20) => {
  return api.get<CommentInterface[]>(`/comments/${filename}`, {
    params: { limit }
  });
}

/**
 * Создать комментарии для файла
 * @param comments - массив комментариев для создания
 */
const postMarkup = async (comments: CreateCommentRequest[]) => {
  return api.post<CommentInterface[]>('/comments', comments);
}

export { getMarkup, postMarkup };