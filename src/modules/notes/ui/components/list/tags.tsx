import type { TagDto } from "@/modules/notes/contracts";

type NotesListTagsProps = {
  availableTags: TagDto[];
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
        className="block text-xs font-medium text-[var(--app-muted-ink)]"
      >
        タグ OR 条件
      </label>
      <div className="mt-1 flex flex-wrap gap-2">
        <select
          id="notes-tag"
          className="min-h-10 min-w-0 flex-1 basis-0 rounded-[0.45rem] border border-[var(--app-line-strong)] bg-[var(--app-paper-surface)] px-3 py-2 text-sm text-[var(--app-ink)] focus-visible:border-[var(--app-focus)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="min-h-10 shrink-0 rounded-[0.45rem] border border-[var(--app-line-strong)] bg-[var(--app-surface)] px-3 py-2 text-sm font-medium text-[var(--app-ink)] transition-colors hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent-deep)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
              aria-label={`${name} を条件から外す`}
              className="inline-flex max-w-full items-center rounded-full border border-[var(--app-accent)] bg-[var(--app-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--app-accent-deep)] transition-colors hover:bg-[var(--app-surface)] focus-visible:outline-2 focus-visible:outline-[var(--app-focus)] focus-visible:outline-offset-2"
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
