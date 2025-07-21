// components/TagInput.tsx

import { useState, KeyboardEvent, ChangeEvent } from 'react';

interface TagInputProps {
  productId: number;
  existingTags: Array<{id: number, name: string, color: string}>;
  onTagAdded: (tag: {id: number, name: string, color: string}) => void;
}

export default function TagInput({ productId, existingTags, onTagAdded }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComposing, setIsComposing] = useState(false); // IME入力中フラグ

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME入力中は何もしない
    if (isComposing) return;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleAddTag = async () => {
    if (!inputValue.trim() || isSubmitting) return;

    // 重複チェック
    const isDuplicate = existingTags.some(tag => 
      tag.name.toLowerCase() === inputValue.trim().toLowerCase()
    );
    
    if (isDuplicate) {
      alert('同じ名前のタグが既に存在します');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/user-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          name: inputValue.trim(),
          color: selectedColor
        })
      });

      if (!response.ok) {
        throw new Error('タグの追加に失敗しました');
      }

      const newTag = await response.json();
      
      // 親コンポーネントに新しいタグを通知
      onTagAdded(newTag);
      
      // 入力フィールドをクリア
      setInputValue('');
      
    } catch (error) {
      console.error('タグ追加エラー:', error);
      alert('タグの追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        placeholder="タグを追加"
        className="px-2 py-1 border rounded text-sm"
        disabled={isSubmitting}
      />
      
      <select
        value={selectedColor}
        onChange={(e) => setSelectedColor(e.target.value)}
        className="px-2 py-1 border rounded text-sm"
        disabled={isSubmitting}
      >
        <option value="blue">青</option>
        <option value="red">赤</option>
        <option value="green">緑</option>
        <option value="yellow">黄</option>
        <option value="purple">紫</option>
      </select>
      
      <button
        onClick={handleAddTag}
        disabled={!inputValue.trim() || isSubmitting}
        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-300"
      >
        {isSubmitting ? '追加中...' : '追加'}
      </button>
    </div>
  );
}