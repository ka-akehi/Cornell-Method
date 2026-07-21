import type { NoteTag } from "@/modules/notes/remote";

type NotesListTagsProps = {
  availableTags: NoteTag[];
  selectedTags: string[];
  tagToAdd: string;
  tagsLoading: boolean;
  onTagToAddChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (name: string) => void;
};

export function NotesListTags({
  availableTags,
  selectedTags,
  tagToAdd,
  tagsLoading,
  onTagToAddChange,
  onAddTag,
  onRemoveTag,
}: NotesListTagsProps) {
  return (
    <div className="min-w-0">
      <label
        htmlFor="notes-tag"
        className="block text-xs font-medium text-stone-500"
      >
        タグ OR 条件
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <select
          id="notes-tag"
          className="min-h-10 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-500 disabled:bg-stone-100"
          value={tagToAdd}
          onChange={(event) => onTagToAddChange(event.target.value)}
          disabled={tagsLoading || availableTags.length === 0}
        >
          <option value="">
            {tagsLoading ? "タグ読み込み中" : "タグを選択"}
          </option>
          {availableTags.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="min-h-10 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
          onClick={onAddTag}
          disabled={!tagToAdd || selectedTags.includes(tagToAdd)}
        >
          追加
        </button>
      </div>
      {selectedTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedTags.map((name) => (
            <button
              key={name}
              type="button"
              className="max-w-full rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              onClick={() => onRemoveTag(name)}
              title={`${name} を条件から外す`}
            >
              <span className="inline-block max-w-[16rem] truncate align-bottom">
                {name}
              </span>
              <span aria-hidden="true"> x</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
