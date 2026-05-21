import { useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Connection,
  Edge,
  Node,
  NodeChange,
  applyNodeChanges,
} from 'reactflow';
import CustomNode from './CustomNode';

const nodeTypes = {
  custom: CustomNode,
};

interface FlowEditorProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
}

const GRID_SIZE = 20;
const NODE_SPACING = 10;

export default function FlowEditor({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  onConnect 
}: FlowEditorProps) {

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const filteredChanges = changes.filter(change => {
      if (change.type === 'position' && change.position) {
        const targetNode = nodes.find(n => n.id === change.id);
        if (!targetNode) return true;

        // Use measured dimensions if available, otherwise fallback or use style width
        const w = targetNode.width || targetNode.style?.width || 260;
        const h = targetNode.height || targetNode.style?.height || 150;
        
        // Calculate potential new bounding box
        // change.position is absolute position? No, it might be delta or absolute.
        // React Flow's onNodesChange usually provides the new position in change.position if dragging.
        
        const newRect = {
          x: change.position.x,
          y: change.position.y,
          w: Number(w),
          h: Number(h)
        };

        // Check collision with all other nodes
        const hasCollision = nodes.some(other => {
          if (other.id === change.id) return false;
          
          const otherW = other.width || other.style?.width || 260;
          const otherH = other.height || other.style?.height || 150;

          const otherRect = {
            x: other.position.x,
            y: other.position.y,
            w: Number(otherW),
            h: Number(otherH)
          };

          // Check intersection with spacing buffer
          return (
            newRect.x < otherRect.x + otherRect.w + NODE_SPACING &&
            newRect.x + newRect.w + NODE_SPACING > otherRect.x &&
            newRect.y < otherRect.y + otherRect.h + NODE_SPACING &&
            newRect.y + newRect.h + NODE_SPACING > otherRect.y
          );
        });

        return !hasCollision;
      }
      return true;
    });

    onNodesChange(filteredChanges);
  }, [nodes, onNodesChange]);
  
  return (
    <div className="h-full w-full bg-stone-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        snapToGrid={true}
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        fitView
      >
        <Controls className="!bg-stone-800 !border-stone-700 [&>button]:!fill-stone-300 [&>button]:!border-stone-700 hover:[&>button]:!bg-stone-700" />
        <MiniMap className="!bg-stone-800" maskColor="rgba(28, 25, 23, 0.7)" nodeColor="#57534e" />
        <Background gap={GRID_SIZE} size={1} color="#44403c" />
      </ReactFlow>
    </div>
  );
}
