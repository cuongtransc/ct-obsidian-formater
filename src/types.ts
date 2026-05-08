import type { FormatOptions } from './formatter';
import { DEFAULT_FORMAT_OPTIONS } from './formatter';

export interface FormatterSettings extends FormatOptions {
	formatOnPaste: boolean;
	setImageSizeOnPaste: boolean;
	pastedImageSize: number;
}

export const DEFAULT_SETTINGS: FormatterSettings = {
	...DEFAULT_FORMAT_OPTIONS,
	formatOnPaste: true,
	setImageSizeOnPaste: true,
	pastedImageSize: 1000,
};
