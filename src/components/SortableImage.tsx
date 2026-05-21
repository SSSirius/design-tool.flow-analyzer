import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical } from 'lucide-react';

interface SortableImageProps {
  key?: string;
  id: string;
  src: string;
  onRemove: (id: string) => void;
}

export function SortableImage({ id, src, onRemove }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group bg-stone-800 rounded-lg overflow-hidden border border-stone-700 aspect-square"
    >
      <img src={src} alt="Upload" className="w-full h-full object-cover" />
      
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-1 left-1 p-1 bg-black/50 rounded text-white opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical size={14} />
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={14} />
      </button>
    </div>
  );
}
