const NOTE_DATE_IMMUTABLE_MESSAGE = "保存後の学習日は編集できません";

export class NoteDateImmutableError extends Error {
  constructor() {
    super(NOTE_DATE_IMMUTABLE_MESSAGE);
    this.name = "NoteDateImmutableError";
  }
}
