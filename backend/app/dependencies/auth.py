from fastapi import Request, HTTPException
from dao.user_dao import UserDAO


def get_current_user_email(request: Request) -> str:
    """
    Получить email текущего пользователя из request.state.
    Устанавливается AuthMiddleware после проверки JWT токена.
    """
    return request.state.user_email


async def get_verified_user_id(request: Request) -> int:
    """
    Получить ID текущего пользователя и проверить, что он существует в БД.
    Кидает HTTPException 404, если пользователь не найден.
    """
    user_id = request.state.user_id

    user = await UserDAO.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User with id {user_id} not found in database. Please re-authenticate."
        )

    return user_id
