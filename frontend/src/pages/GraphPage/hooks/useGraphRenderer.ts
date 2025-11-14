import { useCallback, type RefObject } from 'react';
import * as d3 from 'd3';
import type { OntologyNode } from '../../../shared/types/OntologyManager';
import type { RDFLink } from '../../../shared/types/graphTypes';
import styles from '../GraphPage.module.css';

export const useGraphRenderer = (
  svgRef: RefObject<SVGSVGElement | null>,
  nodes: OntologyNode[],
  links: RDFLink[],
  isSaving: boolean,
  setSelectedNode: (node: OntologyNode | null) => void,
  setPopupPosition: (pos: { x: number; y: number }) => void,
  handleSaveGraph: () => void,
  handleUploadClick: () => void,
  setShowMenu: (show: boolean) => void
) => {
  const buildTree = useCallback((nodes: OntologyNode[], links: RDFLink[]): OntologyNode | undefined => {
    console.log('buildTree: Building tree with', nodes.length, 'nodes and', links.length, 'links');
    const nodeMap = new Map<string, OntologyNode>();
    nodes.forEach(node => {
      console.log('buildTree: Creating node map entry for', node.id, node.label);
      nodeMap.set(node.id, {
        id: node.id,
        label: node.label,
        type: node.type,
        children: []
      });
    });

    const addedChildren = new Set<string>();
    
    links.forEach(link => {
      const parent = nodeMap.get(link.source);
      const child = nodeMap.get(link.target);

      const linkKey = `${link.source}->${link.target}`;
      if (parent && child && !addedChildren.has(linkKey)) {
        parent.children!.push(child);
        addedChildren.add(linkKey);
      }
    });
const rootNodes = nodes.filter(
  node =>
    node.id === "http://example.org/root" || 
    (!links.some(l => l.target === node.id) && node.label === "Корень")
);

    
    if (rootNodes.length === 0) {
      console.warn('No root nodes found, possible cyclic graph');
      console.log('Creating virtual root for all nodes');
      const allNodes = Array.from(nodeMap.values());
      console.log('buildTree: Virtual root will have', allNodes.length, 'children');
      console.log('buildTree: Children labels:', allNodes.map(n => n.label));
      return {
        id: "virtual_root",
        label: "Граф",
        type: "class",
        children: allNodes
      };
    }
    
    if (rootNodes.length > 1) {
      console.log('Multiple root nodes found:', rootNodes.length);
      return {
        id: "virtual_root",
        label: "Корень",
        type: "class",
        children: rootNodes.map(node => nodeMap.get(node.id)!).filter(Boolean)
      };
    }

    console.log('Single root node found:', rootNodes[0].label);
    return nodeMap.get(rootNodes[0].id);
  }, []);

  const renderTree = useCallback(() => {
    if (!nodes.length) {
      console.log('No nodes to render');
      return;
    }
    const MAX_NODES = 1000;
    if (nodes.length > MAX_NODES) {
      console.error(`Graph too large: ${nodes.length} nodes (max ${MAX_NODES})`);
      alert(`Граф слишком большой (${nodes.length} узлов). Максимум ${MAX_NODES} узлов для отображения.`);
      return;
    }

    const svgEl = svgRef.current;
    if (!svgEl) {
      console.log('SVG element not ready');
      return;
    }

    try {
      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();

    const width = svgEl.clientWidth;
    const height = svgEl.clientHeight;
    const g = svg.append('g');

    const hierarchyData = buildTree(nodes, links);
    if (!hierarchyData) {
      console.log('No hierarchy data to render');
      return;
    }

    console.log('renderTree: hierarchyData:', hierarchyData);
    console.log('renderTree: hierarchyData has', hierarchyData.children?.length || 0, 'children');

    const root = d3.hierarchy(hierarchyData);
    console.log('renderTree: d3.hierarchy created, descendants:', root.descendants().length);
    
    const treeLayout = d3.tree<any>()
      .size([height * 3, width * 0.7])
      .separation(() => 1.5);

    treeLayout(root);
    const buttonStyle = {
      width: 160,
      height: 40,
      rx: 8,
      ry: 8,
      fill: "#ffffffff",
      stroke: "#000000ff",
      strokeWidth: 1
    };
    const createButton = (yPos: number, text: string, onClick: () => void, disabled = false) => {
      const button = svg.append('g')
        .attr("transform", `translate(20,${yPos})`)
        .style("cursor", disabled ? "not-allowed" : "pointer")
        .on("click", onClick);

      if (disabled) {
        button.style("pointer-events", "none");
      }

      button.on("mouseover", function() {
          d3.select(this).select("rect").attr("fill", "#c08bdcff");
        })
        .on("mouseout", function() {
          d3.select(this).select("rect").attr("fill", "#ffffffff");
        });

      button.append("rect")
        .attr("width", buttonStyle.width)
        .attr("height", buttonStyle.height)
        .attr("rx", buttonStyle.rx)
        .attr("ry", buttonStyle.ry)
        .attr("fill", buttonStyle.fill)
        .attr("stroke", buttonStyle.stroke)
        .attr("stroke-width", buttonStyle.strokeWidth)
        .attr("filter", "url(#button-shadow)");

      const textElement = button.append("text")
        .attr("x", buttonStyle.width / 2)
        .attr("y", buttonStyle.height / 2 + 5)
        .attr("text-anchor", "middle")
        .attr("fill", "black")
        .attr("font-size", "14px")
        .attr("font-weight", "500");

      if (isSaving && text === "Сохранить") {
        textElement.text("Сохранение...");
      } else {
        textElement.text(text);
      }
    };
    createButton(height - 80, "Создать новый", () => setShowMenu(true));
    createButton(height - 130, "Сохранить", handleSaveGraph, isSaving);
    createButton(height - 180, "Загрузить из файла", handleUploadClick);
    createButton(height - 230, "Скачать JSON", () => {
      const data = { nodes, links };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "graph.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    const defs = svg.append("defs");
    const filter = defs.append("filter")
      .attr("id", "button-shadow")
      .attr("height", "130%")
      .attr("width", "130%");

    filter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", 2)
      .attr("result", "blur");
    filter.append("feOffset")
      .attr("in", "blur")
      .attr("dx", 1)
      .attr("dy", 1)
      .attr("result", "offsetBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "offsetBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    g.selectAll(".link")
      .data(root.links() as d3.HierarchyPointLink<OntologyNode>[])
      .enter()
      .append("path")
      .attr("class", styles.link)
      .attr("d", d3.linkVertical<any, any>()
        .x(d => d.x!)
        .y(d => d.y!))
      .attr("stroke-width", 1.5)
      .each(function(d: d3.HierarchyPointLink<OntologyNode>) {
        const source = d.source as d3.HierarchyPointNode<OntologyNode>;
        const target = d.target as d3.HierarchyPointNode<OntologyNode>;
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;

        const linkData = links.find(l =>
          l.source === source.data.id && l.target === target.data.id
        );

        if (linkData) {
          const label = linkData.predicate.split(/[#\/]/).pop() || linkData.predicate;
          const labelGroup = g.append("g");
          const tempText = labelGroup.append("text")
            .attr("class", styles.linkLabel)
            .attr("x", midX)
            .attr("y", midY)
            .attr("text-anchor", "middle")
            .attr("dy", "-0.5em")
            .text(label);
          const bbox = (tempText.node() as SVGTextElement).getBBox();
          const padding = 4;
          labelGroup.insert("rect", "text")
            .attr("class", styles.linkLabelBackground)
            .attr("x", bbox.x - padding)
            .attr("y", bbox.y - padding)
            .attr("width", bbox.width + padding * 2)
            .attr("height", bbox.height + padding * 2);
        }
      });
    const descendants = root.descendants();
    console.log('renderTree: Rendering', descendants.length, 'node elements');
    console.log('renderTree: Node labels to render:', descendants.map(d => d.data.label));
    
    const nodeGroups = g.selectAll(".node")
      .data(descendants)
      .enter()
      .append("g")
      .attr("class", (d: any) => `${styles.node} ${styles[d.data.type]}`)
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`);

    nodeGroups.on("click", function(event, d: any) {
      event.stopPropagation();
      setSelectedNode(d.data);
      setPopupPosition({ x: event.clientX, y: event.clientY });
    });

    nodeGroups.append("circle")
      .attr("r", 20)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    nodeGroups.append("text")
      .attr("dy", "0")
      .attr("x", 0)
      .attr("y", 35)
      .style("text-anchor", "middle")
      .style("fill", "#222")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text((d: any) => d.data.label.length > 20
        ? `${d.data.label.substring(0, 20)}...`
        : d.data.label
      );
    const zoom = d3.zoom<any, any>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom)
      .call(zoom.transform, d3.zoomIdentity.translate(width / 2, 60).scale(0.8));
    
    } catch (error) {
      console.error('Error rendering tree:', error);
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
    }
  }, [nodes, links, buildTree, handleUploadClick, handleSaveGraph, isSaving, setSelectedNode, setPopupPosition, setShowMenu, svgRef]);

  return { renderTree };
};
