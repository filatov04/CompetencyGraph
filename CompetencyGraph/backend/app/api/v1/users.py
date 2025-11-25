from typing import List
from fastapi import APIRouter, HTTPException, Query, Request
import logging

from dao.user_dao import UserDAO
from dependencies.auth import get_verified_user_id

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/users/me")
async def get_current_user(request: Request) -> dict:
    """Получить информацию о текущем пользователе"""
    try:
        user_id = await get_verified_user_id(request)
        user = await UserDAO.get_user_by_id(user_id)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}")
async def get_user_by_id(user_id: int) -> dict:
    """Получить информацию о пользователе по ID"""
    try:
        user = await UserDAO.get_user_by_id(user_id)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user by id: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/email/{email}")
async def get_user_by_email(email: str) -> dict:
    """Получить информацию о пользователе по email"""
    try:
        user = await UserDAO.get_user_by_email(email)

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user by email: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
async def get_users_by_ids(
    ids: List[int] = Query(..., description="Список ID пользователей")
) -> List[dict]:
    """Получить информацию о нескольких пользователях по списку ID"""
    try:
        users = await UserDAO.get_users_by_ids(ids)
        return users
    except Exception as e:
        logger.error(f"Error getting users by ids: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
