/**
 * PFM Volar LanguagePlugin.
 *
 * Teaches Volar how to handle .pfm files by producing TypeScript
 * VirtualCode through the pipeline:
 *
 *   PFM source -> pfmToSvelte -> svelte2tsx -> compose mappings -> VirtualCode
 */

import type {
	LanguagePlugin,
	VirtualCode,
	IScriptSnapshot,
	CodegenContext,
} from '@volar/language-core';
import type { TypeScriptExtraServiceScript } from '@volar/typescript';

import type * as TS from 'typescript';

import { create_config_loader } from './config.js';
import type { ConfigLoader } from './config.js';
import {
	create_virtual_code_from_source,
	PFM_LANGUAGE_ID,
	type PfmVirtualCode,
} from './virtual_code.js';

/** always documents, .svx is the default extension of the vite plugin */
const EXTENSIONS = ['.pfm', '.svx'];

/** never documents, so their language needs no config lookup */
const NOT_DOCUMENTS = /\.(?:[cm]?[jt]sx?|svelte|json|css|d\.ts|map)$/;

export interface PfmLanguagePluginOptions {
	/** reads the exports of templates a mdsvex.config.json names, without it they replace nothing */
	typescript?: typeof TS;
	/** where the mdsvex config of a document comes from, by default the nearest manifest or json config */
	config?: ConfigLoader;
}

/** Simple string hash for content-based caching. */
function hash_string(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = ((h << 5) - h + s.charCodeAt(i)) | 0;
	}
	return h;
}

/**
 * Create a PFM LanguagePlugin for Volar.
 *
 * Usage:
 *   const plugin = createPfmLanguagePlugin();
 *   // Pass to @volar/language-server or @volar/kit
 */
export function create_pfm_language_plugin(
	plugin_options: PfmLanguagePluginOptions = {}
): LanguagePlugin<string, PfmVirtualCode> {
	// a file converts again only when its content or config changed
	const cache = new Map<
		string,
		{ hash: number; stamp: string; result: PfmVirtualCode }
	>();
	const config =
		plugin_options.config ??
		create_config_loader({ typescript: plugin_options.typescript });

	function virtual_code(scriptId: string, snapshot: IScriptSnapshot) {
		const source = snapshot.getText(0, snapshot.getLength());
		const hash = hash_string(source);
		const { stamp, options } = config.options_for(scriptId);
		const cached = cache.get(scriptId);
		if (cached && cached.hash === hash && cached.stamp === stamp) {
			return cached.result;
		}

		const result = create_virtual_code_from_source(source, scriptId, options);
		cache.set(scriptId, { hash, stamp, result });
		return result;
	}

	return {
		getLanguageId(scriptId: string): string | undefined {
			return is_document(scriptId, config) ? PFM_LANGUAGE_ID : undefined;
		},

		createVirtualCode(
			scriptId: string,
			languageId: string,
			snapshot: IScriptSnapshot,
			_ctx: CodegenContext<string>
		): PfmVirtualCode | undefined {
			if (languageId !== PFM_LANGUAGE_ID) return undefined;
			return virtual_code(scriptId, snapshot);
		},

		updateVirtualCode(
			scriptId: string,
			_virtualCode: PfmVirtualCode,
			newSnapshot: IScriptSnapshot,
			_ctx: CodegenContext<string>
		): PfmVirtualCode | undefined {
			return virtual_code(scriptId, newSnapshot);
		},

		disposeVirtualCode(scriptId: string) {
			cache.delete(scriptId);
		},

		typescript: {
			extraFileExtensions: [
				...EXTENSIONS.map((ext) => ({
					extension: ext.slice(1),
					isMixedContent: true,
					scriptKind: 7 as any, // ts.ScriptKind.Deferred
				})),
			],
			getServiceScript(root: VirtualCode) {
				// Return the embedded TS code as the service script:
				// this tells TypeScript "when resolving this .pfm file
				// as a module, use this TS code for its exports"
				const ts_code = root.embeddedCodes?.find(
					(c) => c.languageId === 'typescript'
				);
				if (ts_code) {
					return {
						code: ts_code,
						extension: '.ts' as any,
						scriptKind: 3 as any, // ts.ScriptKind.TS
					};
				}
				return undefined;
			},
		},
	};
}

/** .pfm and .svx always, another extension when the config of the file lists it */
export function is_document(file: string, config: ConfigLoader): boolean {
	for (const ext of EXTENSIONS) if (file.endsWith(ext)) return true;
	if (NOT_DOCUMENTS.test(file) || !/\.[^./\\]+$/.test(file)) return false;
	const extensions = config.load(file)?.manifest.extensions;
	return extensions !== undefined && extensions.some((e) => file.endsWith(e));
}
