from fastapi import APIRouter, Request
import logging

from dao.comments import CommentsDAO
from models.comments import Comment
from dependencies.auth import get_current_user_email

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/comments", response_model=list[Comment])
async def create_comments(
    request: Request,
    data: list[Comment]
):
    """Создать комментарии к RDF триплетам"""
    # Получаем email текущего пользователя из JWT токена
    author = get_current_user_email(request)

    logger.info(f"Creating {len(data)} comment(s) by {author}")

    comments = []
    for comment_data in data:
        comment = await CommentsDAO.create(
            filename=comment_data.filename,
            start_index=comment_data.start_index,
            end_index=comment_data.end_index,
            subject=comment_data.subject,
            predicate=comment_data.predicate,
            object_=comment_data.object,
            author=author,  # Используем автора из JWT
            created_at=comment_data.created_at
        )
        comments.append(Comment.model_validate(comment))

    return comments

@router.get("/comments/{filename}", response_model=list[Comment])
async def get_comments(
    filename: str,
    limit: int = 20
):
    """Получить список комментариев для указанного файла"""
    logger.info(f"Fetching comments for file: {filename} (limit={limit})")
    comments = await CommentsDAO.get_by_filename(filename, limit)
    return [Comment.model_validate(c) for c in comments]
