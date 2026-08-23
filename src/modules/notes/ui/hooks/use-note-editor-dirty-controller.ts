"use client";

import { useEffect, useRef } from "react";
import type { NoteEditorFormState } from "@/modules/notes/model";
import { registerDesktopDirtyController } from "@/shared/desktop/desktop-close-bridge";

type NoteEditorMode = "create" | "edit";
type NoteEditorSave = () => Promise<boolean>;

type UseNoteEditorDirtyControllerOptions = {
  mode: NoteEditorMode;
  form: NoteEditorFormState;
  save: NoteEditorSave;
};

export function useNoteEditorDirtyController({
  mode,
  form,
  save,
}: UseNoteEditorDirtyControllerOptions) {
  const savedFormSerializedRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const saveRef = useRef<NoteEditorSave>(() => Promise.resolve(false));
  const serializedForm = JSON.stringify(form);

  useEffect(() => {
    if (savedFormSerializedRef.current === null) {
      savedFormSerializedRef.current = serializedForm;
    }
    dirtyRef.current = serializedForm !== savedFormSerializedRef.current;
    saveRef.current = save;
  }, [save, serializedForm]);

  useEffect(
    () =>
      registerDesktopDirtyController({
        isDirty: () => dirtyRef.current,
        save: () => saveRef.current(),
      }),
    [mode],
  );

  return () => {
    savedFormSerializedRef.current = serializedForm;
    dirtyRef.current = false;
  };
}
