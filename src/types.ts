import type { FormatOptions } from './formatter';
import { DEFAULT_FORMAT_OPTIONS } from './formatter';

export interface FormatterSettings extends FormatOptions {
	formatOnPaste: boolean;
}

export const DEFAULT_SETTINGS: FormatterSettings = {
	...DEFAULT_FORMAT_OPTIONS,
	formatOnPaste: true,
};
