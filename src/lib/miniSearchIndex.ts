/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { existsSync } from "fs";
import { dirname } from "path";
import { getOperationManifestFileContent } from "./manifests";
import {
	IndexOperationStruct,
	ManifestRequiredParameters,
	MiniSearchIndex,
} from "./types";
import MiniSearch from "minisearch";
import { extractOperationNameFromFullOperationDirectory } from "../helpers/helperOperations";

export const miniSearchBuildIndexFromManifestsList = (
	manifestsList: string[],
	timeStart: number
) => {
	const indexedOperations: IndexOperationStruct[] = [];
	manifestsList.forEach((item) => {
		const result = miniSearchGetOperationTexts(item);
		if (result) indexedOperations.push(result);
	});
	return miniSearchCreateIndex(indexedOperations, timeStart);
};

/**
 *
 * index:
 * 	name: name of operation full path
 * 	comment: comment of operation
 * 	parameters required : list of parameters with comment
	parameters optional : list of parameters with comment */
export const miniSearchGetOperationTexts = (
	manifestFilePath: string
): IndexOperationStruct | null => {
	if (existsSync(manifestFilePath)) {
		try {
			const content = getOperationManifestFileContent(manifestFilePath, false);
			if (content) {
				const indexObject: IndexOperationStruct = {
					id: manifestFilePath,
					name: extractOperationNameFromFullOperationDirectory(
						dirname(manifestFilePath)
					),
					comment: content.comment || "",
					parametersRequired: [],
					parametersOptional: [],
				};
				const required = content.parameters
					?.required as ManifestRequiredParameters;
				for (const parameter of Object.getOwnPropertyNames(required)) {
					if (required && required[parameter])
						indexObject.parametersRequired.push({
							name: parameter,
							comment: required[parameter].comment || "",
						});
				}
				return indexObject;
			}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (error) {
			// error in manifest, will not be indexed
		}
	} else {
		throw new Error(`Manifest file: ${manifestFilePath} was not found`);
	}
	return null;
};

export const miniSearchCreateIndex = (
	indexedOperations: IndexOperationStruct[],
	timeStart: number
): MiniSearchIndex => {
	const miniSearch = new MiniSearch({
		fields: ["name", "comment"], // fields to index for full-text search
		storeFields: ["name", "id", "comment"], // fields to return with search results
	});
	miniSearch.addAll(indexedOperations);
	return { index: miniSearch, executedInMs: new Date().valueOf() - timeStart };
};
