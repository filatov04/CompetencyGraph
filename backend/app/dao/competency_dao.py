from typing import List
import re
import logging
from fastapi import Depends
from dependency_injector import wiring
from SPARQLWrapper import SPARQLWrapper, SPARQLExceptions

import requests

from models.graph import OntologyNode, NodeType
from dependencies.config import Config

logger = logging.getLogger(__name__)



class CompetencyDAO:
    @classmethod
    def _get_prefixes(cls, config: Config) -> dict[str, str]:
        return {
            "": f"<{config.graphdb.url}/repositories/{config.graphdb.repository}#>",
            "rdf": "<http://www.w3.org/1999/02/22-rdf-syntax-ns#>",
            "rdfs": "<http://www.w3.org/2000/01/rdf-schema#>",
            "owl": "<http://www.w3.org/2002/07/owl#>",
        }

    @classmethod
    def _prefix_str(cls, config: Config) -> str:
        prefixes = cls._get_prefixes(config)
        return "\n".join(f"PREFIX {k}: {v}" for k, v in prefixes.items())

    @classmethod
    async def _execute_stmt(cls, client: SPARQLWrapper, stmt: str) -> dict:
        client.setQuery(stmt)
        try:
            result = client.query().convert()
            return result
        except SPARQLExceptions.EndPointInternalError as e:
            raise RuntimeError(f"Ошибка GraphDB: {e}")
        except Exception as e:
            raise RuntimeError(f"Ошибка выполнения SPARQL-запроса: {e}")

    @classmethod
    def _extract_local_name(cls, uri: str) -> str:
        match = re.search(r'#(.+)$', uri)
        return match.group(1) if match else uri

    # -------------------- helpers (NEW) --------------------

    @classmethod
    def _is_uri(cls, value: str) -> bool:
        return isinstance(value, str) and value.startswith(("http://", "https://"))
    
    @classmethod
    def _sanitize_fragment(cls, value: str) -> str:
        """Сделать безопасный хвост для URI из произвольной строки."""
        v = value.strip()
        # все пробельные символы -> подчёркивания
        v = re.sub(r'\s+', '_', v)
        # убираем совсем опасные символы для IRI
        for ch in '<>"{}|^`':
            v = v.replace(ch, '')
        return v


#NEW
    @classmethod
    def _ensure_uri(cls, value: str, repo: str) -> str:
        if cls._is_uri(value):
            return value
        if not value:
            return value
        safe = cls._sanitize_fragment(value)
        return f"http://example.org/{repo}#{safe}"



    # ------------------------------------------------------

    @classmethod
    async def get_graph_from_db(
        cls,
        client: SPARQLWrapper = Depends(wiring.Provide["graphdb_client"]),
        config: Config = Depends(wiring.Provide["config"])
    ) -> dict:
        """
        Получает весь граф из GraphDB (только пользовательские данные) и
        возвращает как URI→URI ребра, так и URI→literal свойства.
        Для литералов добавляем признак literal=True и поля value/datatype/lang.
        """
        prefixes = cls._prefix_str(config)
        RDFS_LABEL_URI = "http://www.w3.org/2000/01/rdf-schema#label"

        query = f"""
        {prefixes}
        SELECT ?s ?p ?o
        WHERE {{
            ?s ?p ?o .

            # исключаем системные namespace для субъекта
            FILTER (!STRSTARTS(STR(?s), "http://www.w3.org/1999/02/22-rdf-syntax-ns#"))
            FILTER (!STRSTARTS(STR(?s), "http://www.w3.org/2000/01/rdf-schema#"))
            FILTER (!STRSTARTS(STR(?s), "http://www.w3.org/2002/07/owl#"))
            FILTER (!STRSTARTS(STR(?s), "http://www.w3.org/XML/1998/namespace"))
            FILTER (!STRSTARTS(STR(?s), "http://www.w3.org/2001/XMLSchema#"))
            FILTER (!STRSTARTS(STR(?s), "http://proton.semanticweb.org/protonsys#"))

            # исключаем системные предикаты, НО оставляем rdfs:label
            FILTER (
                !STRSTARTS(STR(?p), "http://www.w3.org/1999/02/22-rdf-syntax-ns#") &&
                !STRSTARTS(STR(?p), "http://www.w3.org/2002/07/owl#") &&
                !STRSTARTS(STR(?p), "http://www.w3.org/XML/1998/namespace") &&
                !STRSTARTS(STR(?p), "http://www.w3.org/2001/XMLSchema#") &&
                !STRSTARTS(STR(?p), "http://proton.semanticweb.org/protonsys#") &&
                (
                    !STRSTARTS(STR(?p), "http://www.w3.org/2000/01/rdf-schema#")
                    || STR(?p) = "{RDFS_LABEL_URI}"
                )
            )

            # исключаем системные URI-объекты
            FILTER (
                !(isURI(?o) && (
                    STRSTARTS(STR(?o), "http://www.w3.org/1999/02/22-rdf-syntax-ns#") ||
                    STRSTARTS(STR(?o), "http://www.w3.org/2000/01/rdf-schema#") ||
                    STRSTARTS(STR(?o), "http://www.w3.org/2002/07/owl#") ||
                    STRSTARTS(STR(?o), "http://www.w3.org/XML/1998/namespace") ||
                    STRSTARTS(STR(?o), "http://www.w3.org/2001/XMLSchema#") ||
                    STRSTARTS(STR(?o), "http://proton.semanticweb.org/protonsys#")
                ))
            )
        }}
        """

        try:
            data = await cls._execute_stmt(client, query)
        except Exception as e:
            raise RuntimeError(f"Ошибка при получении графа: {str(e)}")

        bindings = data.get("results", {}).get("bindings", [])
        if not bindings:
            return {"nodes": [], "links": []}

        nodes_dict: dict[str, dict] = {}
        links: list[dict] = []
        predicates_set = set()

        RDFS_LABEL = RDFS_LABEL_URI

        # 1) собираем множество предикатов
        for b in bindings:
            predicates_set.add(b["p"]["value"])

        # 2) собираем узлы и связи
        for b in bindings:
            s = b["s"]["value"]
            p = b["p"]["value"]
            o_val = b["o"]["value"]
            o_type = b["o"]["type"]
            o_dt   = b["o"].get("datatype")
            o_lang = b["o"].get("xml:lang")

            # --- rdfs:label: берём как подпись узла ---
            if p == RDFS_LABEL and o_type == "literal":
                node = nodes_dict.get(s)
                if not node:
                    nodes_dict[s] = {
                        "id": s,
                        "label": o_val,   # ← здесь будет "объект", "как дела", "ттттт..." и т.п.
                        "type": "class"
                    }
                else:
                    node["label"] = o_val
                # не добавляем это как ребро
                continue
            # -------------------------------------------

            # субъект как узел (fallback, если нет rdfs:label)
            if s not in nodes_dict and s not in predicates_set:
                nodes_dict[s] = {
                    "id": s,
                    "label": s.split("#")[-1].split("/")[-1],
                    "type": "class"
                }

            if o_type == "uri":
                # объект-URI как узел
                if o_val not in nodes_dict and o_val not in predicates_set:
                    nodes_dict[o_val] = {
                        "id": o_val,
                        "label": o_val.split("#")[-1].split("/")[-1],
                        "type": "class"
                    }
                links.append({
                    "source": s,
                    "target": o_val,
                    "predicate": p
                })
            elif o_type == "literal":
                # URI → literal как отдельное "атрибутное" ребро
                lit_link = {
                    "source": s,
                    "target": o_val,
                    "predicate": p,
                    "literal": True
                }
                if o_dt:
                    lit_link["datatype"] = o_dt
                if o_lang:
                    lit_link["lang"] = o_lang
                links.append(lit_link)

        return {
            "nodes": list(nodes_dict.values()),
            "links": links
        }


    
    @classmethod
    def _is_system_uri(cls, uri: str) -> bool:
        system_namespaces = [
            "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            "http://www.w3.org/2000/01/rdf-schema#",
            "http://www.w3.org/2002/07/owl#",
            "http://www.w3.org/XML/1998/namespace",
            "http://www.w3.org/2001/XMLSchema#",
            "http://proton.semanticweb.org/protonsys#"
        ]
        return any(uri.startswith(ns) for ns in system_namespaces)

    @classmethod
    async def save_graph_to_db(
        cls,
        graph_data: dict,
        config: Config = Depends(wiring.Provide["config"])
    ) -> bool:
        """
        Сохраняет граф в GraphDB через прямой HTTP запрос
        Фильтрует системные RDF/RDFS/OWL узлы и связи
        """
        type_map = {
            "class": "http://www.w3.org/2000/01/rdf-schema#Class",
            "property": "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property"
        }

        graphdb_url = f"{config.graphdb.url}/repositories/{config.graphdb.repository}/statements"
        auth = ("admin", "root")

        successful = 0
        total = 0
        skipped_system = 0

        repo = config.graphdb.repository

        # Индекс литералов: id -> label (для target-узлов типа literal)
        literal_nodes: dict[str, str] = {
            n["id"]: n.get("label", n["id"])
            for n in graph_data.get("nodes", [])
            if n.get("type") == "literal"
        }

        # -------- Узлы --------
        for node in graph_data.get("nodes", []):
            node_uri = node["id"]

            # if cls._is_system_uri(node_uri):
            #     logger.debug(f"Skipping system URI: {node_uri}")
            #     skipped_system += 1
            #     continue

            # literal-узлы не создаём как ресурсы
            # if node.get("type") == "literal":
            #     logger.info(f"Skipping literal node: {node_uri}")
            #     continue

            # нормализуем id узла на всякий случай
            node_uri = cls._ensure_uri(node_uri, repo)

            node_type = type_map.get(node.get("type"), "http://www.w3.org/2000/01/rdf-schema#Class")
            label = (node.get("label") or node_uri).replace('"', '\\"')

            query = f"""
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            INSERT DATA {{ <{node_uri}> a <{node_type}>; rdfs:label "{label}". }}
            """
            logger.info(f"[SPARQL NODE INSERT] Sending query:\n{query}")

            try:
                response = requests.post(
                    graphdb_url,
                    data={"update": query},
                    auth=auth,
                    headers={"Accept": "application/json"}
                )
                response.raise_for_status()
                successful += 1
            except Exception as e:
                logger.warning(f"Failed to save node {node_uri}: {e}")

            total += 1

        # -------- Связи --------
        for link in graph_data.get("links", []):
            raw_source = link['source']
            raw_predicate = link['predicate']
            raw_target = link['target']

            # 1) нормализуем в URI (до проверок)
            source = cls._ensure_uri(raw_source, repo)
            predicate = cls._ensure_uri(raw_predicate, repo)
            target_candidate = raw_target  # может быть literal-узел/строка

            # 2) если target — известный literal-узел, берём его label как текст
            #    или если target не URI — трактуем как литерал (строка)
            is_target_uri = cls._is_uri(target_candidate)
            if target_candidate in literal_nodes:
                target_literal = literal_nodes[target_candidate]
                is_target_uri = False
            elif not is_target_uri:
                # это литерал, не узел — используем как есть
                target_literal = str(target_candidate)
            else:
                target_literal = None  # это URI

            # 3) системные URI — после нормализации
            # if cls._is_system_uri(source) or cls._is_system_uri(predicate) or (is_target_uri and cls._is_system_uri(target_candidate)):
            #     logger.debug(f"Skipping system link: {source} -> {target_candidate} ({predicate})")
            #     skipped_system += 1
            #     continue

            # 4) проверка валидности source/predicate
            if not cls._is_uri(source):
                logger.warning(f"Skipping invalid source URI: {source} (must start with http:// or https://)")
                total += 1
                continue
            if not cls._is_uri(predicate):
                logger.warning(f"Skipping invalid predicate URI: {predicate} (must start with http:// or https://)")
                total += 1
                continue

            ## 5) формируем SPARQL для URI- или literal-объекта
            target_str = str(target_candidate).strip()

            # если target — это URI, добавляем как ссылку
            if target_str.startswith("http://") or target_str.startswith("https://"):
                target = cls._ensure_uri(target_str, repo)
                query = f"""INSERT DATA {{ <{source}> <{predicate}> <{target}>. }}"""
            else:
                lit = (target_literal or target_str or "").replace('"', '\\"')
                query = f"""INSERT DATA {{ <{source}> <{predicate}> "{lit}". }}"""


            logger.info(f"[SPARQL LINK INSERT] Sending query:\n{query}")

            try:
                response = requests.post(
                    graphdb_url,
                    data={"update": query},
                    auth=auth,
                    headers={"Accept": "application/json"}
                )
                response.raise_for_status()
                successful += 1
            except Exception as e:
                logger.warning(f"Failed to save link {source} -> {target_candidate}: {e}")

            total += 1

        logger.info(f"Saved graph to GraphDB: {successful}/{total} successful, {skipped_system} system URIs skipped")
        return successful > 0

    @classmethod
    async def add_triple(
        cls,
        subject: str,
        predicate: str,
        object_value: str,
        config: Config = Depends(wiring.Provide["config"])
    ) -> bool:
        """
        Добавить один триплет в GraphDB
        Поддерживает как URI-объект, так и литерал.
        """
        graphdb_url = f"{config.graphdb.url}/repositories/{config.graphdb.repository}/statements"
        auth = ("admin", "root")

        repo = config.graphdb.repository
        s = cls._ensure_uri(subject, repo)
        p = cls._ensure_uri(predicate, repo)

        if cls._is_uri(object_value):
            o_part = f"<{cls._ensure_uri(object_value, repo)}>"
        else:
            lit = object_value.replace('"', '\\"')
            o_part = f"\"{lit}\""

        query = f"""INSERT DATA {{ <{s}> <{p}> {o_part}. }}"""

        try:
            response = requests.post(
                graphdb_url,
                data={"update": query},
                auth=auth,
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()
            logger.info(f"Added triple: <{s}> <{p}> {o_part}")
            return True
        except Exception as e:
            logger.error(f"Failed to add triple: {e}")
            raise RuntimeError(f"Failed to add triple: {e}")

    @classmethod
    async def delete_triple(
        cls,
        subject: str,
        predicate: str,
        object_value: str,
        config: Config = Depends(wiring.Provide["config"])
    ) -> bool:
        graphdb_url = f"{config.graphdb.url}/repositories/{config.graphdb.repository}/statements"
        auth = ("admin", "root")

        repo = config.graphdb.repository
        s = cls._ensure_uri(subject, repo)
        p = cls._ensure_uri(predicate, repo)

        if cls._is_uri(object_value):
            o_part = f"<{cls._ensure_uri(object_value, repo)}>"
        else:
            lit = object_value.replace('"', '\\"')
            o_part = f"\"{lit}\""

        query = f"""DELETE DATA {{ <{s}> <{p}> {o_part}. }}"""

        try:
            response = requests.post(
                graphdb_url,
                data={"update": query},
                auth=auth,
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()
            logger.info(f"Deleted triple: <{s}> <{p}> {o_part}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete triple: {e}")
            raise RuntimeError(f"Failed to delete triple: {e}")

    @classmethod
    async def delete_node(
        cls,
        node_uri: str,
        config: Config = Depends(wiring.Provide["config"])
    ) -> bool:
        graphdb_url = f"{config.graphdb.url}/repositories/{config.graphdb.repository}/statements"
        auth = ("admin", "root")

        query1 = f"""DELETE WHERE {{ <{node_uri}> ?p ?o . }}"""
        query2 = f"""DELETE WHERE {{ ?s ?p <{node_uri}> . }}"""

        try:
            response = requests.post(
                graphdb_url,
                data={"update": query1},
                auth=auth,
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()

            response = requests.post(
                graphdb_url,
                data={"update": query2},
                auth=auth,
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()

            logger.info(f"Deleted node: <{node_uri}> and all related triples")
            return True
        except Exception as e:
            logger.error(f"Failed to delete node: {e}")
            raise RuntimeError(f"Failed to delete node: {e}")

    @classmethod
    async def clear_repository(
        cls,
        config: Config = Depends(wiring.Provide["config"])
    ) -> bool:
        graphdb_url = f"{config.graphdb.url}/repositories/{config.graphdb.repository}/statements"
        auth = ("admin", "root")

        query = """DELETE WHERE { ?s ?p ?o . }"""

        try:
            response = requests.post(
                graphdb_url,
                data={"update": query},
                auth=auth,
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()
            logger.warning("Cleared entire repository!")
            return True
        except Exception as e:
            logger.error(f"Failed to clear repository: {e}")
            raise RuntimeError(f"Failed to clear repository: {e}")

    @classmethod
    @wiring.inject
    async def get_graph_part(
        cls,
        start_from: str,
        depth: int = 2,
        limit: int = 50,
        offset: int = 0,
        client: SPARQLWrapper = Depends(wiring.Provide["graphdb_client"]),
        config: Config = Depends(wiring.Provide["config"])
    ) -> dict:
        prefixes = cls._prefix_str(config)
        repo = config.graphdb.repository

        if start_from.startswith(("http://", "https://")):
            start_uri = f"<{start_from}>"
        else:
            start_uri = f"<http://example.org/{repo}#{start_from}>"

        query = f"""
        {prefixes}

        SELECT DISTINCT ?id ?label ?type
        WHERE {{
            {{
                BIND({start_uri} AS ?id)
                OPTIONAL {{ ?id rdfs:label ?label . }}
            }}
            UNION
            {{
                {start_uri} ?p1 ?id .
                OPTIONAL {{ ?id rdfs:label ?label . }}
            }}
            UNION
            {{
                {start_uri} ?p1 ?mid1 .
                ?mid1 ?p2 ?id .
                OPTIONAL {{ ?id rdfs:label ?label . }}
            }}

            BIND(
                IF(EXISTS {{ ?id a rdfs:Class }}, "class",
                IF(EXISTS {{ ?id a rdf:Property }}, "property",
                "literal")) AS ?type)
        }}
        OFFSET {offset}
        LIMIT {limit}
        """

        data = await cls._execute_stmt(client, query)

        nodes = []
        seen_nodes = set()

        for binding in data["results"]["bindings"]:
            if "id" in binding:
                node_id = binding["id"]["value"]
                if node_id not in seen_nodes:
                    seen_nodes.add(node_id)
                    nodes.append({
                        "id": node_id,
                        "label": binding.get("label", {}).get("value", node_id),
                        "type": binding.get("type", {}).get("value", "class")
                    })

        links = await cls._get_links_between_nodes(client, config, list(seen_nodes))

        return {
            "nodes": nodes,
            "links": links
        }

    @classmethod
    async def _get_links_between_nodes(
        cls,
        client: SPARQLWrapper,
        config: Config,
        node_uris: list[str]
    ) -> list[dict]:
        if not node_uris:
            return []

        prefixes = cls._prefix_str(config)
        values_clause = " ".join([f"<{uri}>" for uri in node_uris])

        query = f"""
        {prefixes}

        SELECT DISTINCT ?source ?target ?predicate
        WHERE {{
            VALUES ?source {{ {values_clause} }}
            VALUES ?target {{ {values_clause} }}
            ?source ?predicate ?target .
            FILTER(?source != ?target)
        }}
        """

        try:
            data = await cls._execute_stmt(client, query)
            links = []
            for binding in data["results"]["bindings"]:
                if "source" in binding and "target" in binding:
                    links.append({
                        "source": binding["source"]["value"],
                        "target": binding["target"]["value"],
                        "predicate": binding.get("predicate", {}).get("value",
                            "http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
                    })
            return links
        except Exception as e:
            logger.warning(f"Error getting links between nodes: {e}")
            return []

    @classmethod
    async def get_graph_part_from_json(
        cls,
        graph_data: dict,
        start_from: str,
        depth: int = 2
    ) -> dict:
        nodes = [
            node for node in graph_data["nodes"]
            if node["id"] == start_from
        ]

        links = [
            link for link in graph_data["links"]
            if link["source"] == start_from or link["target"] == start_from
        ]

        return {
            "nodes": nodes[:depth*10],
            "links": links[:depth*10]
        }

    @classmethod
    @wiring.inject
    async def get_ancestors(
        cls,
        competency_id: str,
        limit: int = 50,
        offset: int = 0,
        client: SPARQLWrapper = Depends(wiring.Provide["graphdb_client"]),
        config: Config = Depends(wiring.Provide["config"])
    ) -> List[OntologyNode]:
        prefixes = cls._prefix_str(config)

        if competency_id.startswith("http://") or competency_id.startswith("https://"):
            comp_uri = f"<{competency_id}>"
        else:
            comp_uri = f"<http://example.org/{config.graphdb.repository}#{competency_id}>"

        query = f"""
        {prefixes}

        SELECT DISTINCT ?ancestor ?label ?level
        WHERE {{
        ?ancestor (<http://example.org/hasSubCompetence>)+ {comp_uri} .
        OPTIONAL {{ ?ancestor rdfs:label ?label . }}
        OPTIONAL {{
            ?ancestor :hasLevel1 ?_ .
            BIND(1 AS ?level)
        }}
        OPTIONAL {{
            ?ancestor :hasLevel2 ?_ .
            BIND(2 AS ?level)
        }}
        OPTIONAL {{
            ?ancestor :hasLevel3 ?_ .
            BIND(3 AS ?level)
        }}
        OPTIONAL {{
            ?ancestor :hasLevel4 ?_ .
            BIND(4 AS ?level)
        }}
        OPTIONAL {{
            ?ancestor :hasLevel5 ?_ .
            BIND(5 AS ?level)
        }}
        }}
        OFFSET {offset}
        LIMIT {limit}
        """

        data = await cls._execute_stmt(client, query)

        ancestors = []
        for binding in data["results"]["bindings"]:
            ancestor_uri = binding["ancestor"]["value"]
            label = binding.get("label", {}).get("value", ancestor_uri)

            ancestors.append(
                OntologyNode(
                    id=ancestor_uri,
                    label=label,
                    type=NodeType.CLASS
                )
            )

        return ancestors

    @classmethod
    @wiring.inject
    async def get_descendants(
        cls,
        competency_id: str,
        limit: int = 50,
        offset: int = 0,
        client: SPARQLWrapper = Depends(wiring.Provide["graphdb_client"]),
        config: Config = Depends(wiring.Provide["config"])
    ) -> List[OntologyNode]:
        prefixes = cls._prefix_str(config)

        if competency_id.startswith("http://") or competency_id.startswith("https://"):
            comp_uri = f"<{competency_id}>"
        else:
            comp_uri = f"<http://example.org/{config.graphdb.repository}#{competency_id}>"

        query = f"""
        {prefixes}

        SELECT DISTINCT ?descendant ?label ?level
        WHERE {{
        {comp_uri} (<http://example.org/hasSubCompetence>)+ ?descendant .
        OPTIONAL {{ ?descendant rdfs:label ?label . }}
        OPTIONAL {{
            ?descendant :hasLevel1 ?_ .
            BIND(1 AS ?level)
        }}
        OPTIONAL {{
            ?descendant :hasLevel2 ?_ .
            BIND(2 AS ?level)
        }}
        OPTIONAL {{
            ?descendant :hasLevel3 ?_ .
            BIND(3 AS ?level)
        }}
        OPTIONAL {{
            ?descendant :hasLevel4 ?_ .
            BIND(4 AS ?level)
        }}
        OPTIONAL {{
            ?descendant :hasLevel5 ?_ .
            BIND(5 AS ?level)
        }}
        }}
        OFFSET {offset}
        LIMIT {limit}
        """

        data = await cls._execute_stmt(client, query)

        descendants = []
        for binding in data["results"]["bindings"]:
            descendant_uri = binding["descendant"]["value"]
            label = binding.get("label", {}).get("value", descendant_uri)

            descendants.append(
                OntologyNode(
                    id=descendant_uri,
                    label=label,
                    type=NodeType.CLASS
                )
            )

        return descendants

    @classmethod
    @wiring.inject
    async def find_path(
        cls,
        start_id: str,
        end_id: str,
        client: SPARQLWrapper = Depends(wiring.Provide["graphdb_client"]),
        config: Config = Depends(wiring.Provide["config"])
    ) -> List[OntologyNode]:
        prefixes = cls._prefix_str(config)

        if start_id.startswith("http://") or start_id.startswith("https://"):
            start_uri = f"<{start_id}>"
        else:
            start_uri = f"<http://example.org/{config.graphdb.repository}#{start_id}>"

        if end_id.startswith("http://") or end_id.startswith("https://"):
            end_uri = f"<{end_id}>"
        else:
            end_uri = f"<http://example.org/{config.graphdb.repository}#{end_id}>"

        query = f"""
        {prefixes}

        SELECT ?node ?label
        WHERE {{
        VALUES (?start ?end) {{ ({start_uri} {end_uri}) }}

        ?start (<http://example.org/hasSubCompetence>)+ ?end .

        ?node ( ^<http://example.org/hasSubCompetence>* | <http://example.org/hasSubCompetence>* ) ?end .

        OPTIONAL {{ ?node rdfs:label ?label . }}
        }}
        """

        data = await cls._execute_stmt(client, query)

        nodes = []
        seen = set()

        for binding in data["results"]["bindings"]:
            node_uri = binding["node"]["value"]
            label = binding.get("label", {}).get("value", node_uri)

            if node_uri not in seen:
                seen.add(node_uri)
                nodes.append(
                    OntologyNode(
                        id=node_uri,
                        label=label,
                        type=NodeType.CLASS
                    )
                )

        return nodes