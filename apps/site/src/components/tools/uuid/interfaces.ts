export interface DigitType {
  label: string;
  color: string;
}

export interface UUIDGeneratorProps {
  version: number;
  getInfo: (value: string) => void;
}
