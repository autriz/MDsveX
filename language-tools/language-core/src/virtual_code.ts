import type {
	VirtualCode,
	IScriptSnapshot,
	CodeMapping,
} from '@volar/language-core';
import { forEachEmbeddedCode } from '@volar/language-core';

import { pfmToSvelte } from '@mdsvex/source-map/pfm-to-svelte';
import type {
	EditorMappingData,
	ExcludedRegion,
	PfmDiagnostic,
	PfmToSvelteOptions,
	PfmToSvelteResult,
	PropsProbe,
} from '@mdsvex/source-map/pfm-to-svelte';
import { v3ToVolarMappings } from '@mdsvex/source-map/v3-to-volar';
import { composeMappings } from '@mdsvex/source-map/compose-mappings';
import { svelte2tsx as svelte_2_tsx } from 'svelte2tsx';

export const PFM_LANGUAGE_ID = 'pfm';
// a directive up to its label, then its args in parens
const DIRECTIVE_ARGS =
	/((?<![\w:]):{1,3}[A-Za-z_][\w-]*\[(?:[^[\]\n\\]|\\.|\[[^[\]\n]*\])*\])(\([^)\n]*\))/g;

import { SVELTE_SHIMS } from './_svelte_shims';
import {
	ALL_CAPABILITIES,
	caps_key,
	editor_caps,
	is_empty,
	merge_capabilities,
} from './capabilities';

/** Prepend shims content to svelte2tsx output and shift mappings. */
function inject_shims(
	tsx_code: string,
	raw_mappings: ReturnType<typeof v3ToVolarMappings>
): { code: string; mappings: typeof raw_mappings } {
	if (!SVELTE_SHIMS) return { code: tsx_code, mappings: raw_mappings };
	const prefix = SVELTE_SHIMS + '\n';
	const prefixLen = prefix.length;
	return {
		code: prefix + tsx_code,
		mappings: raw_mappings.map((m) => ({
			...m,
			generatedOffsets: m.generatedOffsets.map((o) => o + prefixLen),
		})),
	};
}

export interface PfmVirtualCode extends VirtualCode {
	id: string;
	languageId: string;
	snapshot: IScriptSnapshot;
	mappings: CodeMapping[];
	embeddedCodes: VirtualCode[];
	/** compile errors and warnings, typescript reports the rest */
	diagnostics: PfmDiagnostic[];
	/** the yaml of the frontmatter, null without any */
	frontmatter: { start: number; end: number } | null;
	/** the templates the frontmatter template key can name */
	templates: TemplateChoice[];
	/** the template the document compiled with */
	template?: string;
	/** type aliases in the typescript code holding the props of each template and directive */
	probes: PropsProbe[];
}

export interface TemplateChoice {
	name: string;
	/** the template file relative to the document, when the config resolves it */
	file?: string;
}

/** Create a simple IScriptSnapshot from a string. */
function create_snapshot(text: string): IScriptSnapshot {
	return {
		getText: (start, end) => text.slice(start, end),
		getLength: () => text.length,
		getChangeRange: () => undefined,
	};
}

type CompiledOptions = {
	compiled: PfmToSvelteResult;
	compile_options: PfmToSvelteOptions;
	embedded_codes: VirtualCode[];
};
type ErrorOptions = {
	error: PfmDiagnostic;
};

function build_virtual_code(
	source: string,
	options: ErrorOptions
): PfmVirtualCode;
function build_virtual_code(
	source: string,
	options: CompiledOptions
): PfmVirtualCode;
function build_virtual_code(
	source: string,
	options: CompiledOptions | ErrorOptions
): PfmVirtualCode {
	const rest = (() => {
		if (!('error' in options)) {
			return {
				diagnostics: options.compiled.diagnostics,
				embeddedCodes: options.embedded_codes,
				templates: template_choices(options.compile_options),
				frontmatter: options.compiled.frontmatter,
				template: options.compiled.template,
				probes: options.compiled.probes,
			};
		} else {
			return {
				diagnostics: [options.error],
				embeddedCodes: [],
				templates: [],
				frontmatter: null,
				probes: [],
			};
		}
	})();

	return {
		...build_embedded_code('root', PFM_LANGUAGE_ID, source, [
			{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [source.length],
				// so a service reports compile diagnostics and completes frontmatter on the root
				data: { structure: true, verification: true },
			},
		]),
		...rest,
	};
}

function build_embedded_code(
	id: string,
	language_id: string,
	source: string,
	mappings: CodeMapping[]
): VirtualCode {
	return {
		id,
		languageId: language_id,
		snapshot: create_snapshot(source),
		mappings,
	};
}

function template_choices(options: PfmToSvelteOptions): TemplateChoice[] {
	const templates = options.compile?.templates ?? {};
	return Object.keys(templates).map((name) => {
		const file = options.resolve?.(templates[name].specifier, 'default');
		return file === undefined ? { name } : { name, file };
	});
}

function svelte2tsx_error_to_diagnostic(error: any): PfmDiagnostic {
	// @ts-ignore svelte compiler error has those
	const { start, end, message } = error;

	return {
		message,
		start: start.character,
		end: end.character,
		severity: 'error',
	};
}

/**
 * Run the full PFM to TypeScript pipeline and produce VirtualCode.
 * On any error (parse failure, svelte2tsx crash), returns a fallback
 * VirtualCode with no TS features instead of crashing the server.
 */
export function create_virtual_code_from_source(
	source: string,
	script_id: string,
	options: PfmToSvelteOptions
): PfmVirtualCode {
	let svelte;
	try {
		// Step 1: PFM to Svelte
		svelte = pfmToSvelte(source, options);
	} catch (err) {
		return build_virtual_code(source, { error: err as PfmDiagnostic });
	}

	let tsx;
	try {
		// Step 2: Svelte to TypeScript via svelte2tsx
		tsx = svelte_2_tsx(svelte.code, {
			filename: script_id.replace(/\.[^./\\]+$/, '.svelte'),
			isTsFile: false,
			mode: 'ts',
		});
	} catch (err) {
		return build_virtual_code(source, {
			error: svelte2tsx_error_to_diagnostic(err),
		});
	}

	// Step 3: Convert svelte2tsx's v3 source map to Volar format + inject shims
	const v3_map = tsx.map;
	const raw_svelte_to_ts = v3ToVolarMappings(
		v3_map as any,
		tsx.code,
		svelte.code
	);
	const { code: ts_code, mappings: svelte_to_ts_mappings } = inject_shims(
		tsx.code,
		raw_svelte_to_ts
	);

	// Step 4: Filter mappings for composition.
	// - Exclude "node" role (broadest spans cause duplicate hover results)
	// - Exclude zero-length source mappings
	// - Upgrade capabilities to full, let svelte2tsx's B-side gate features
	const markdown_props: typeof svelte.mappings = [];
	const filtered_mappings = svelte.mappings
		.filter((m) => (m.data as any).role !== 'node' && m.lengths[0] > 0)
		.filter((m) => {
			// svelte2tsx splits the key of a prop markdown makes, so it is not composed piece by piece
			if (typeof m.data.verification !== 'object') return true;
			markdown_props.push(m);
			return false;
		})
		// mappings read through accessors, so a spread would drop the arrays
		.map((m) => ({
			sourceOffsets: m.sourceOffsets,
			generatedOffsets: m.generatedOffsets,
			lengths: m.lengths,
			...(m.generatedLengths ? { generatedLengths: m.generatedLengths } : {}),
			// a mapping the converter added keeps its own capabilities
			data: (m.data as EditorMappingData).editor
				? editor_caps(m.data as EditorMappingData)
				: ALL_CAPABILITIES,
		}));

	// Step 5: Compose PFM to Svelte + Svelte to TS = PFM to TS
	// Use B's capabilities but disable format (overlapping ranges crash the formatter).
	const pfm_to_ts = composeMappings(
		filtered_mappings as any,
		svelte_to_ts_mappings,
		merge_capabilities
	).filter((m) => !is_empty(m.data));
	for (const m of markdown_props) {
		const g = m.generatedOffsets[0];
		const length = m.generatedLengths ? m.generatedLengths[0] : m.lengths[0];
		const range = generated_span(svelte_to_ts_mappings, g, g + length);
		if (range === null) continue;
		pfm_to_ts.push({
			sourceOffsets: [m.sourceOffsets[0]],
			generatedOffsets: [range[0]],
			lengths: [m.lengths[0]],
			generatedLengths: [range[1] - range[0]],
			data: editor_caps(m.data as EditorMappingData),
		});
	}

	// Step 5b: Merge single-char non-identity mappings into adjacent
	// neighbors.  svelte2tsx splits attribute names at the first character
	// (e.g. "v" to '"' + "alue=" to 'alue"') and maps syntax chars to filler
	// spaces.  These 1-char mappings cause two problems via Volar's
	// inclusive-end (<=) translateOffset:
	//  1. Diagnostic highlights bleed through whitespace (char to space anchors)
	//  2. Duplicate hover at attribute-name boundaries (v/alue overlap)
	// Merging them into the next mapping eliminates the boundary overlap
	// while preserving hover on the first character.
	pfm_to_ts.sort((a, b) => a.sourceOffsets[0] - b.sourceOffsets[0]);
	for (let i = pfm_to_ts.length - 2; i >= 0; i--) {
		const m = pfm_to_ts[i];
		if (m.lengths[0] !== 1) continue;
		const gen_len = m.generatedLengths ? m.generatedLengths[0] : 1;
		if (gen_len !== 1) continue;
		const src_ch = source.charCodeAt(m.sourceOffsets[0]);
		const gen_ch = ts_code.charCodeAt(m.generatedOffsets[0]);
		if (src_ch === gen_ch) continue; // identity, leave as-is

		const next = pfm_to_ts[i + 1];
		// a mapping the converter added keeps its capabilities apart
		if (!m.data.editor !== !next.data.editor) continue;
		const next_gen_len = next.generatedLengths
			? next.generatedLengths[0]
			: next.lengths[0];

		// Merge into next if source-adjacent and generated gap <= 1
		if (
			m.sourceOffsets[0] + 1 === next.sourceOffsets[0] &&
			next.generatedOffsets[0] - (m.generatedOffsets[0] + 1) <= 1
		) {
			const new_gen_start = m.generatedOffsets[0];
			const new_gen_end = next.generatedOffsets[0] + next_gen_len;
			next.sourceOffsets[0] = m.sourceOffsets[0];
			next.lengths[0] += 1;
			next.generatedOffsets[0] = new_gen_start;
			const new_gen_len = new_gen_end - new_gen_start;
			next.generatedLengths =
				new_gen_len !== next.lengths[0] ? [new_gen_len] : undefined;
			pfm_to_ts.splice(i, 1);
		}
	}

	// svelte2tsx quotes a prop key and typescript spans both quotes, so an arg takes the closing one
	for (const m of pfm_to_ts) {
		if (!m.data.editor) continue;
		const start = m.generatedOffsets[0];
		const len = m.generatedLengths ? m.generatedLengths[0] : m.lengths[0];
		if (ts_code[start] === '"' && ts_code[start + len] === '"' && len > 1)
			m.generatedLengths = [len + 1];
	}

	// Step 6: Shrink non-identity trailing boundaries at adjacency points.
	// Volar's translateOffset uses inclusive end (<=) so adjacent mappings
	// share boundary offsets.  When the last source char differs from the
	// last generated char (e.g. "}" becomes ","), the previous mapping wrongly
	// claims the next token's start, causing diagnostic highlights to
	// bleed through inter-attribute whitespace.  We only shrink when the
	// next mapping starts at exactly this mapping's generated end, to
	// avoid dropping diagnostics at the final mapping.
	const by_gen_offset = pfm_to_ts
		.slice()
		.sort((a, b) => a.generatedOffsets[0] - b.generatedOffsets[0]);
	for (let i = 0; i < by_gen_offset.length - 1; i++) {
		const m = by_gen_offset[i];
		const next = by_gen_offset[i + 1];
		if (m.data.editor) continue;
		const src_len = m.lengths[0];
		const gen_len = m.generatedLengths ? m.generatedLengths[0] : src_len;
		if (gen_len <= 1) continue;
		const gen_end = m.generatedOffsets[0] + gen_len;
		if (gen_end !== next.generatedOffsets[0]) continue;
		const last_src = source.charCodeAt(m.sourceOffsets[0] + src_len - 1);
		const last_gen = ts_code.charCodeAt(m.generatedOffsets[0] + gen_len - 1);
		if (last_src !== last_gen) {
			m.generatedLengths = [gen_len - 1];
		}
	}

	// Step 7: Deduplicate composed mappings that share the same source range.
	// svelte2tsx maps identifiers like `Test` to multiple TS positions
	// (import, type alias, constructor).  Keeping only the first (lowest
	// generated offset) prevents Volar from combining all their hover
	// results into one noisy tooltip.
	{
		const seen = new Set<string>();
		let write = 0;
		for (let read = 0; read < pfm_to_ts.length; read++) {
			const m = pfm_to_ts[read];
			// a prop markdown makes shares its markdown with the others of the element
			if (typeof m.data.verification === 'object') {
				pfm_to_ts[write++] = m;
				continue;
			}
			// a frontmatter key maps once to hover and once to check
			const key =
				m.sourceOffsets[0] + ':' + m.lengths[0] + ':' + caps_key(m.data);
			if (seen.has(key)) continue;
			seen.add(key);
			pfm_to_ts[write++] = m;
		}
		pfm_to_ts.length = write;
	}

	// Build the TypeScript embedded VirtualCode
	const ts_virtual_code = build_embedded_code(
		'ts',
		'typescript',
		ts_code,
		pfm_to_ts
	);

	// Build CSS embedded VirtualCodes from <style> blocks
	const embedded_codes: VirtualCode[] = [ts_virtual_code];
	const all_caps = {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
		structure: true,
		format: true,
	};

	for (let i = 0; i < svelte.styleBlocks.length; i++) {
		const sb = svelte.styleBlocks[i];
		const css_text = source.slice(sb.sourceStart, sb.sourceEnd);
		embedded_codes.push(
			build_embedded_code('style_' + i, 'css', css_text, [
				{
					sourceOffsets: [sb.sourceStart],
					generatedOffsets: [0],
					lengths: [css_text.length],
					data: all_caps,
				},
			])
		);
	}

	// Build markdown VirtualCode: PFM source with excluded regions
	// (frontmatter, script, style, imports) not mapped to the source so the markdown
	// service sees clean markdown without setext-heading false positives.
	// Use excluded regions and directives to get markdown mappings.
	const md_mappings = get_markdown_mappings(svelte.excludedRegions, source);
	// Reconstruct markdown parts from source offsets.
	let md_source = '';
	for (let idx = 0; idx < md_mappings.offsets.length; idx++) {
		md_source += source.slice(
			md_mappings.offsets[idx],
			md_mappings.offsets[idx] + md_mappings.lengths[idx]
		);
	}
	// Remove directive args, the args of a directive would read as the url of a link.
	md_source = md_source.replace(
		DIRECTIVE_ARGS,
		(_, head: string, args: string) => head + ' '.repeat(args.length)
	);

	embedded_codes.push(
		build_embedded_code('md', 'markdown', md_source, [
			{
				sourceOffsets: md_mappings.offsets,
				generatedOffsets: md_mappings.offsets.map(
					(offset) => offset - md_mappings.offsets[0]
				),
				lengths: md_mappings.lengths,
				data: {
					structure: true,
					navigation: true,
					completion: true,
					semantic: true,
				},
			},
		])
	);

	return build_virtual_code(source, {
		compile_options: options,
		compiled: svelte,
		embedded_codes,
	});
}

/** the generated span of the mappings that overlap start to end, null for none */
function generated_span(
	mappings: ReturnType<typeof v3ToVolarMappings>,
	start: number,
	end: number
): [number, number] | null {
	let from = Infinity;
	let to = -Infinity;
	for (const m of mappings) {
		const s = m.sourceOffsets[0];
		const e = s + m.lengths[0];
		if (s >= end || e <= start) continue;
		const g = m.generatedOffsets[0];
		const length = m.generatedLengths ? m.generatedLengths[0] : m.lengths[0];
		from = Math.min(from, g + Math.min(Math.max(start - s, 0), length));
		to = Math.max(to, g + Math.min(Math.min(end, e) - s, length));
	}
	return to > from ? [from, to] : null;
}

function get_markdown_mappings(
	excluded_regions: ExcludedRegion[],
	source: string
) {
	const sorted_regions = excluded_regions.sort((a, b) => a.start - b.start);
	// If regions are adjacent (i.e. end of one is 5 and start of next one is 6), merge them.
	let merged_regions = [{ ...excluded_regions[0] }];

	for (let i = 1; i < sorted_regions.length; i++) {
		const current = sorted_regions[i];
		const last = merged_regions[merged_regions.length - 1];

		if (current.start <= last.end + 1) {
			last.end = Math.max(last.end, current.end);
		} else {
			merged_regions.push({ ...current });
		}
	}

	// Convert distance between merged regions into mappings.
	let offsets = [];
	let lengths = [];
	let source_offset = 0;

	for (const { start, end } of merged_regions) {
		if (source_offset < start) {
			offsets.push(source_offset);
			lengths.push(start - source_offset);
		}
		source_offset = Math.max(source_offset, end + 1);
	}

	if (source_offset < source.length) {
		offsets.push(source_offset);
		lengths.push(source.length - source_offset);
	}

	return { offsets, lengths };
}
