/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { getProcessEnvValue } from "./system";
import { consoleLog } from "../helpers/helperUI";
import { miniSearchBuildIndexFromManifestsList } from "./miniSearchIndex";
import { OperationStructForSelectPrompt } from "./types";
import { SearchResult } from "minisearch";
import { getOperationsPath } from "./filePathResolver";
import {
	extractOperationNameFromFullOperationDirectory,
	getOperationsManifestPathList,
} from "../helpers/helperOperations";
import { dirname } from "path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const searchCommand = async (words: any, commanderOptions: any) => {
	const OPSDirectory = getProcessEnvValue("OPS");
	if (!OPSDirectory || !OPSDirectory.trim()) {
		throw new Error(`"${OPSDirectory}" is not OPSDirectory`);
	}

	const operationsPath = getOperationsPath(OPSDirectory);
	const manifestsList = getOperationsManifestPathList(operationsPath);
	const start = new Date().valueOf();
	const miniSearchIndex = miniSearchBuildIndexFromManifestsList(
		manifestsList,
		start
	);
	const manifestsFiltered: OperationStructForSelectPrompt[] = [];
	if (words && miniSearchIndex) {
		const results: SearchResult[] = miniSearchIndex.index.search(words, {
			fuzzy: 0.3,
		});
		if (commanderOptions.displayScore) consoleLog(results.join(","));
		for (const line of results) {
			if (line.score > (words.split(" ").length > 1 ? 10 : 2))
				manifestsFiltered.push({
					manifest: (line as SearchResult).id as string,
					comment: (line as SearchResult)["comment"],
				});
		}
	}
	if (!manifestsFiltered.length && words) {
		consoleLog(
			`  No operation corresponds to the filter shown: ${words} - try again`,
			"red"
		);
	}
	consoleLog(`Filter: ${words}`, "yellow");
	consoleLog(`OPSDirectory: ${OPSDirectory}`, "cyan");
	consoleLog(
		manifestsFiltered
			.map((item) => {
				return `[*] ${extractOperationNameFromFullOperationDirectory(
					dirname(item.manifest)
				)} - ${item.comment}`;
			})
			.join("\n"),
		"green"
	);
};
