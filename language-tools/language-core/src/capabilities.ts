import type { EditorMappingData } from '@mdsvex/source-map/pfm-to-svelte';
import type { CodeInformation } from '@mdsvex/render/mappings';

export const ALL_CAPABILITIES: CodeInformation = {
	verification: true,
	completion: true,
	semantic: true,
	navigation: true,
	structure: true,
};

/** the composed capabilities, a mapping the converter added keeps only what it allows */
export function merge_capabilities(
	a: CodeInformation & { editor?: true },
	b: CodeInformation
): CodeInformation & { editor?: true } {
	if (!a.editor) return { ...b, format: false };
	const out: CodeInformation & { editor?: true } = { editor: true };
	// a check the converter narrowed keeps its own filter
	if (a.verification && b.verification)
		out.verification =
			typeof a.verification === 'object' ? a.verification : b.verification;
	if (a.completion && b.completion) out.completion = b.completion;
	if (a.semantic && b.semantic) out.semantic = b.semantic;
	if (a.navigation && b.navigation) out.navigation = b.navigation;
	if (a.structure && b.structure) out.structure = b.structure;
	return out;
}

export function editor_caps(
	data: EditorMappingData
): CodeInformation & { editor: true } {
	const out: CodeInformation & { editor: true } = { editor: true };
	if (data.verification) out.verification = data.verification;
	if (data.completion) out.completion = true;
	if (data.semantic) out.semantic = true;
	if (data.navigation) out.navigation = true;
	if (data.structure) out.structure = true;
	return out;
}

export function is_empty(data: CodeInformation): boolean {
	return (
		!data.verification &&
		!data.completion &&
		!data.semantic &&
		!data.navigation &&
		!data.structure &&
		!data.format
	);
}

export function caps_key(data: CodeInformation): string {
	return (
		(data.verification ? 'v' : '') +
		(data.semantic ? 's' : '') +
		(data.navigation ? 'n' : '') +
		(data.completion ? 'c' : '')
	);
}
