export enum HandbrakeErrorType {
  VALIDATION = "ValidationError",
  INVALID_INPUT = "InvalidInput",
  INVALID_PRESET = "InvalidPreset",
  OTHER = "Other",
  NOT_FOUND = "HandbrakeCLINotFound",
}

export class HandbrakeError extends Error {
  readonly type: HandbrakeErrorType;
  readonly errorCode?: number;
  output: string;
  options: string;

  constructor(type: HandbrakeErrorType, message: string, errorCode?: number) {
    super(message);
    this.type = type;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, HandbrakeError.prototype);
  }
}
