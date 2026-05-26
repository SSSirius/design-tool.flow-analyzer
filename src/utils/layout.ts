import dagre from 'dagre';
import { Node, Edge, Position } from 'reactflow';

const nodeWidth = 520;
const nodeHeight = 220;

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  const normalizedDirection = direction === 'TB' ? 'TB' : 'LR';
  dagreGraph.setGraph({ 
    rankdir: normalizedDirection,
    nodesep: 80, // Vertical spacing between nodes in same rank
    ranksep: 150  // Horizontal spacing between ranks
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    // We shift the position so that the center of the node is at the position dagre gave us
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      data: {
        ...node.data,
        layoutDirection: normalizedDirection,
      },
    };
  });

  return { nodes: layoutedNodes, edges: edges.map((edge) => ({ ...edge })) };
};
