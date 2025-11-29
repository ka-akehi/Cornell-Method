export type Tag = {
  id?: string;
  name: string;
  color?: string | null;
};

export type CueCard = {
  id?: string;
  marker: string;
  content: string;
  order: number;
  deleted?: boolean;
};

export type NoteCard = {
  id?: string;
  content: string;
  order: number;
  isHidden: boolean;
  cueIds: string[];
  deleted?: boolean;
};
