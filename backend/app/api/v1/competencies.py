from typing import List
from fastapi import APIRouter, HTTPException, Query, Body, Request
import logging

from models.graph import GraphResponse, OntologyNode
from dao.competency_dao import CompetencyDAO
from dao.version_dao import VersionDAO
from dependencies.auth import get_current_user_email, get_verified_user_id

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/competencies/graph", response_model=GraphResponse)
async def get_graph() -> dict:
    """Получить весь граф компетенций из GraphDB"""
    try:
        logger.info("Fetching full competency graph")
        return await CompetencyDAO.get_graph_from_db()
    except Exception as e:
        logger.error(f"Error fetching graph: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/competencies/graph")
async def save_graph(request: Request, graph_data: dict = Body(...)) -> dict:
    """Сохранить граф компетенций в GraphDB с версионированием"""
    try:
        # Получаем user_id из токена и проверяем существование пользователя
        user_id = await get_verified_user_id(request)

        # Валидация данных перед сохранением
        nodes = graph_data.get("nodes", [])
        links = graph_data.get("links", [])
        client_versions = graph_data.get("versions", {})  # версии узлов с клиента

        # Проверяем узлы
        # Мягкая валидация на уровне API:
# - пропускаем только системные URI
# - не требуем http:// у предиката/объекта: DAO сам нормализует/запишет литералы
        valid_nodes = []
        for node in nodes:
            node_id = node.get("id", "")
            if not node_id:
                logger.warning("Skipping node without id")
                continue
            if CompetencyDAO._is_system_uri(node_id):
                logger.debug(f"Skipping system node at API level: {node_id}")
                continue
            # Ничего больше не режем — DAO сам приведёт к URI при необходимости
            valid_nodes.append(node)

        valid_links = []
        for link in links:
            source = link.get("source", "")
            predicate = link.get("predicate", "")
            target = link.get("target", "")

            if not source or not predicate or target is None:
                logger.warning(f"Skipping incomplete link: {link}")
                continue

            # Системные — отбрасываем на API-слое
            if (CompetencyDAO._is_system_uri(source) or
                CompetencyDAO._is_system_uri(predicate) or
                (isinstance(target, str) and CompetencyDAO._is_system_uri(target))):
                logger.debug(f"Skipping system link at API level: {source} -> {target} (predicate: {predicate})")
                continue

            # Не проверяем startswith("http") — DAO сделает:
            # - нормализацию source/predicate/target в URI;
            # - вставку URI→URI или URI→"literal".
            valid_links.append({"source": source, "predicate": predicate, "target": target})


        # Обновляем данные с валидными элементами
        validated_data = {
            "nodes": valid_nodes,
            "links": valid_links
        }

        nodes_count = len(valid_nodes)
        links_count = len(valid_links)
        logger.info(f"Saving graph: {nodes_count} nodes, {links_count} links by user {user_id}")

        # Проверяем конфликты версий (если клиент передал версии)
        if client_versions:
            node_uris = [node["id"] for node in valid_nodes]
            current_versions = await VersionDAO.get_nodes_versions(node_uris)

            conflicts = []
            for cv in current_versions:
                node_uri = cv["node_uri"]
                current_ver = cv["version"]
                expected_ver = client_versions.get(node_uri, 0)

                # Если версия на сервере новее, чем у клиента - конфликт
                if current_ver > expected_ver:
                    # Находим label узла для удобства
                    node_label = next((n["label"] for n in valid_nodes if n["id"] == node_uri), node_uri)

                    conflicts.append({
                        "node_uri": node_uri,
                        "node_label": node_label,
                        "expected_version": expected_ver,
                        "current_version": current_ver,
                        "last_modified": cv.get("last_modified"),
                        "last_modified_by": cv.get("last_modified_by")
                    })

            # Если есть конфликты - отклоняем сохранение
            if conflicts:
                logger.warning(f"Version conflicts detected: {len(conflicts)} nodes")
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "Version conflict detected. Graph has been modified by another user.",
                        "conflicts": conflicts,
                        "suggestion": "Please reload the graph and try again."
                    }
                )

        # Сохраняем граф
        await CompetencyDAO.save_graph_to_db(validated_data)

        # Версионируем изменённые узлы
        # Для каждого узла создаём или обновляем версию
        for node in valid_nodes:
            node_uri = node["id"]
            try:
                await VersionDAO.create_or_update_version(
                    node_uri=node_uri,
                    user_id=user_id,
                    change_type="UPDATE",
                    old_value=None,  # Можно расширить для сохранения старых значений
                    new_value={"label": node.get("label"), "type": node.get("type")}
                )
            except Exception as e:
                logger.warning(f"Failed to version node {node_uri}: {e}")

        return {
            "status": "success",
            "nodes": nodes_count,
            "links": links_count,
            "versioned": True
        }
    except Exception as e:
        logger.error(f"Error saving graph: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/competencies/graph/part", response_model=GraphResponse)
async def get_graph_part(
    node_id: str = Query(..., description="URI узла"),
    depth: int = Query(2, ge=1, le=5),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict:
    """
    Получает часть графа от указанного узла с заданной глубиной.
    """
    try:
        logger.info(f"Fetching graph part: node={node_id}, depth={depth}, limit={limit}")
        return await CompetencyDAO.get_graph_part(
            start_from=node_id,
            depth=depth,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        logger.error(f"Error fetching graph part: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/competencies/graph/from_json")
async def get_graph_from_json(
    graph_data: dict = Body(...),
    start_from: str = Query(...),
    depth: int = Query(2)
):
    return await CompetencyDAO.get_graph_part_from_json(
        graph_data=graph_data,
        start_from=start_from,
        depth=depth
    )


@router.get("/competencies/node/ancestors", response_model=List[OntologyNode])
async def get_ancestors(
    node_id: str = Query(..., description="URI узла"),
    limit: int = Query(50, ge=1, le=100, description="Количество узлов на странице"),
    offset: int = Query(0, ge=0, description="Смещение для пагинации"),
) -> List[OntologyNode]:
    """Получить всех предков компетенции"""
    try:
        logger.info(f"Fetching ancestors for node: {node_id}")
        return await CompetencyDAO.get_ancestors(
            competency_id=node_id,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        logger.error(f"Error fetching ancestors: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competencies/node/descendants", response_model=List[OntologyNode])
async def get_descendants(
    node_id: str = Query(..., description="URI узла"),
    limit: int = Query(50, ge=1, le=100, description="Количество узлов на странице"),
    offset: int = Query(0, ge=0, description="Смещение для пагинации"),
) -> List[OntologyNode]:
    """Получить всех потомков компетенции"""
    try:
        logger.info(f"Fetching descendants for node: {node_id}")
        return await CompetencyDAO.get_descendants(
            competency_id=node_id,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        logger.error(f"Error fetching descendants: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competencies/node/version")
async def get_node_version(
    node_id: str = Query(..., description="URI узла"),
) -> dict:
    """
    Получить текущую версию узла.
    Возвращает версию и время последнего изменения.
    """
    try:
        logger.info(f"Getting version for node: {node_id}")
        version_info = await VersionDAO.get_node_version(node_id)

        if version_info is None:
            # Узел ещё не версионирован
            return {
                "node_uri": node_id,
                "version": 0,
                "last_modified": None,
                "last_modified_by": None
            }

        return version_info
    except Exception as e:
        logger.error(f"Error getting node version: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/competencies/nodes/versions")
async def get_nodes_versions(
    node_uris: List[str] = Body(..., description="Список URI узлов")
) -> dict:
    """
    Получить версии нескольких узлов одновременно (batch operation).
    Полезно для загрузки информации о версиях всех узлов графа.
    """
    try:
        logger.info(f"Getting versions for {len(node_uris)} nodes")
        versions = await VersionDAO.get_nodes_versions(node_uris)

        # Создаём словарь для быстрого доступа
        versions_dict = {v["node_uri"]: v for v in versions}

        # Добавляем дефолтные версии для узлов, которых нет в БД
        result = []
        for uri in node_uris:
            if uri in versions_dict:
                result.append(versions_dict[uri])
            else:
                result.append({
                    "node_uri": uri,
                    "version": 0,
                    "last_modified": None,
                    "last_modified_by": None
                })

        return {
            "versions": result,
            "total": len(result)
        }
    except Exception as e:
        logger.error(f"Error getting nodes versions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competencies/node/history")
async def get_node_history(
    node_id: str = Query(..., description="URI узла"),
    limit: int = Query(10, ge=1, le=100, description="Количество записей истории"),
) -> list[dict]:
    """
    Получить историю изменений узла.
    """
    try:
        logger.info(f"Getting history for node: {node_id}")
        history = await VersionDAO.get_node_history(node_id, limit)
        return history
    except Exception as e:
        logger.error(f"Error getting node history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competencies/version/statistics")
async def get_version_statistics() -> dict:
    """
    Получить статистику по версионированию узлов:
    - Общее количество версионированных узлов
    - Общее количество изменений
    - Топ активных пользователей (по количеству изменений)
    - Последние изменения

    Полезно для dashboard и аналитики.
    """
    try:
        logger.info("Getting version statistics")
        stats = await VersionDAO.get_version_statistics()
        return stats
    except Exception as e:
        logger.error(f"Error getting version statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/competencies/node/update")
async def update_node_with_version(
    node_id: str = Query(..., description="URI узла"),
    request: Request = None,
    data: dict = Body(...),
) -> dict:
    """
    Обновить узел с проверкой версии.
    Body должен содержать: version, old_value, new_value
    """
    try:
        # Получаем user_id из токена
        user_email = get_current_user_email(request)
        user_id = request.state.user_id

        expected_version = data.get("version", 0)
        old_value = data.get("old_value")
        new_value = data.get("new_value")

        # Проверяем конфликт версий
        if expected_version > 0:
            no_conflict = await VersionDAO.check_version_conflict(node_id, expected_version)
            if not no_conflict:
                current = await VersionDAO.get_node_version(node_id)
                raise HTTPException(
                    status_code=409,
                    detail=f"Version conflict: expected {expected_version}, current {current['version']}"
                )

        # Обновляем версию
        new_version = await VersionDAO.create_or_update_version(
            node_uri=node_id,
            user_id=user_id,
            change_type="UPDATE",
            old_value=old_value,
            new_value=new_value
        )

        logger.info(f"Updated node {node_id} to version {new_version} by user {user_email}")

        return {
            "status": "success",
            "node_uri": node_id,
            "version": new_version
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating node with version: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competencies/path", response_model=List[OntologyNode])
async def find_path(
    start_id: str = Query(..., description="ID начальной компетенции"),
    end_id: str = Query(..., description="ID конечной компетенции"),
) -> List[OntologyNode]:
    """Найти путь между двумя компетенциями в графе"""
    try:
        logger.info(f"Finding path from {start_id} to {end_id}")
        return await CompetencyDAO.find_path(
            start_id=start_id,
            end_id=end_id
        )
    except Exception as e:
        logger.error(f"Error finding path: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def _is_uri(v: str) -> bool:
    return isinstance(v, str) and v.startswith(("http://", "https://"))


@router.post("/competencies/triple")
async def add_triple(
    request: Request,
    triple_data: dict = Body(...,
        example={
            "subject": "http://example.org/comp1",
            "predicate": "http://example.org/hasSubCompetence",
            "object": "http://example.org/comp2"
        }
    )
) -> dict:
    """
    Добавить один триплет в граф.
    С версионированием изменения.
    """
    try:
        user_id = await get_verified_user_id(request)

        subject = triple_data.get("subject")
        predicate = triple_data.get("predicate")
        object_value = triple_data.get("object")

        # Валидация URI
        # Разрешаем объект-литерал
        if not (subject and _is_uri(subject) and predicate and _is_uri(predicate)):
            raise HTTPException(
            status_code=400,
            detail="Subject and predicate must be valid URIs (http/https). Object may be URI or literal."
        )

        logger.info(f"Adding triple: <{subject}> <{predicate}> <{object_value}> by user {user_id}")

        # Добавляем триплет
        await CompetencyDAO.add_triple(subject, predicate, object_value)

        # Версионируем изменение
        try:
            version_data = {
                "action": "add_triple",
                "predicate": predicate,
                "object": object_value
            }
            logger.info(f"Attempting to version triple addition with data: {version_data}")
            logger.info(f"Data types - predicate: {type(predicate)}, object: {type(object_value)}")

            await VersionDAO.create_or_update_version(
                node_uri=subject,
                user_id=user_id,
                change_type="UPDATE",
                old_value=None,
                new_value=version_data
            )
            logger.info(f"Successfully versioned triple addition for {subject}")
        except Exception as e:
            logger.warning(f"Failed to version triple addition: {e}")
            logger.warning(f"Version data was: {version_data}")
            logger.warning(f"Subject: {subject}, User ID: {user_id}")

        return {
            "status": "success",
            "message": "Triple added successfully",
            "triple": {
                "subject": subject,
                "predicate": predicate,
                "object": object_value
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding triple: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/competencies/triple")
async def update_triple(
    request: Request,
    update_data: dict = Body(...,
        example={
            "old_triple": {
                "subject": "http://example.org/comp1",
                "predicate": "http://example.org/hasSubCompetence",
                "object": "http://example.org/comp2"
            },
            "new_triple": {
                "subject": "http://example.org/comp1",
                "predicate": "http://example.org/hasSubCompetence",
                "object": "http://example.org/comp3"
            }
        }
    )
) -> dict:
    """
    Обновить триплет (удалить старый и добавить новый).
    С версионированием изменения.
    """
    try:
        user_id = await get_verified_user_id(request)

        old_triple = update_data.get("old_triple", {})
        new_triple = update_data.get("new_triple", {})

        old_subject = old_triple.get("subject")
        old_predicate = old_triple.get("predicate")
        old_object = old_triple.get("object")

        new_subject = new_triple.get("subject")
        new_predicate = new_triple.get("predicate")
        new_object = new_triple.get("object")

        # Валидация URI (subject и predicate должны быть URI, object может быть литералом)
        if not all([
            old_subject and old_subject.startswith(("http://", "https://")),
            old_predicate and old_predicate.startswith(("http://", "https://")),
            new_subject and new_subject.startswith(("http://", "https://")),
            new_predicate and new_predicate.startswith(("http://", "https://"))
        ]):
            raise HTTPException(
                status_code=400,
                detail="Subject and predicate must be valid URIs (http:// or https://)"
            )

        logger.info(f"Updating triple by user {user_id}: OLD <{old_subject}> <{old_predicate}> <{old_object}> -> NEW <{new_subject}> <{new_predicate}> <{new_object}>")

        # Удаляем старый триплет
        await CompetencyDAO.delete_triple(old_subject, old_predicate, old_object)

        # Добавляем новый триплет
        await CompetencyDAO.add_triple(new_subject, new_predicate, new_object)

        # Версионируем изменение
        try:
            await VersionDAO.create_or_update_version(
                node_uri=old_subject,
                user_id=user_id,
                change_type="UPDATE",
                old_value={
                    "action": "update_triple",
                    "old": {"subject": old_subject, "predicate": old_predicate, "object": old_object}
                },
                new_value={
                    "action": "update_triple",
                    "new": {"subject": new_subject, "predicate": new_predicate, "object": new_object}
                }
            )
        except Exception as e:
            logger.warning(f"Failed to version triple update: {e}")

        return {
            "status": "success",
            "message": "Triple updated successfully",
            "old_triple": {
                "subject": old_subject,
                "predicate": old_predicate,
                "object": old_object
            },
            "new_triple": {
                "subject": new_subject,
                "predicate": new_predicate,
                "object": new_object
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating triple: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/competencies/triple")
async def delete_triple(
    request: Request,
    subject: str = Query(..., description="URI субъекта"),
    predicate: str = Query(..., description="URI предиката"),
    object_value: str = Query(..., alias="object", description="URI объекта")
) -> dict:
    """
    Удалить один триплет из графа.
    С версионированием изменения.
    """
    try:
        user_id = await get_verified_user_id(request)

        # Валидация URI (subject и predicate должны быть URI, object может быть литералом)
        if not (subject.startswith(("http://", "https://")) and predicate.startswith(("http://", "https://"))):
            raise HTTPException(
                status_code=400,
                detail="Subject and predicate must be valid URIs (http:// or https://)"
            )

        logger.info(f"Deleting triple: <{subject}> <{predicate}> <{object_value}> by user {user_id}")

        # Удаляем триплет
        await CompetencyDAO.delete_triple(subject, predicate, object_value)

        # Версионируем изменение
        try:
            await VersionDAO.create_or_update_version(
                node_uri=subject,
                user_id=user_id,
                change_type="UPDATE",
                old_value={"action": "delete_triple", "predicate": predicate, "object": object_value},
                new_value=None
            )
        except Exception as e:
            logger.warning(f"Failed to version triple deletion: {e}")

        return {
            "status": "success",
            "message": "Triple deleted successfully",
            "triple": {
                "subject": subject,
                "predicate": predicate,
                "object": object_value
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting triple: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/competencies/node")
async def delete_node(
    request: Request,
    node_id: str = Query(..., description="URI узла для удаления")
) -> dict:
    """
    Удалить узел и все связанные с ним триплеты.
    С версионированием изменения.
    """
    try:
        user_id = await get_verified_user_id(request)

        # Валидация URI
        if not node_id.startswith(("http://", "https://")):
            raise HTTPException(
                status_code=400,
                detail="Node URI must start with http:// or https://"
            )

        logger.info(f"Deleting node: <{node_id}> by user {user_id}")

        # Удаляем узел
        await CompetencyDAO.delete_node(node_id)

        # Версионируем удаление
        try:
            await VersionDAO.create_or_update_version(
                node_uri=node_id,
                user_id=user_id,
                change_type="DELETE",
                old_value={"node_uri": node_id},
                new_value=None
            )
        except Exception as e:
            logger.warning(f"Failed to version node deletion: {e}")

        return {
            "status": "success",
            "message": "Node deleted successfully",
            "node_uri": node_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting node: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/competencies/graph/clear")
async def clear_graph(
    request: Request,
    confirm: bool = Query(False, description="Подтверждение удаления ВСЕХ данных")
) -> dict:
    """
    ⚠️ ОПАСНО: Удалить ВСЕ данные из GraphDB!
    Требует явного подтверждения.
    """
    try:
        if not confirm:
            raise HTTPException(
                status_code=400,
                detail="Please set confirm=true to clear the entire repository"
            )

        user_id = await get_verified_user_id(request)
        logger.warning(f"CLEARING ENTIRE REPOSITORY by user {user_id}")

        # Очищаем репозиторий
        await CompetencyDAO.clear_repository()

        return {
            "status": "success",
            "message": "Repository cleared successfully",
            "warning": "All data has been deleted!"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing repository: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
