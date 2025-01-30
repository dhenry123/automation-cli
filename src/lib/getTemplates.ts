/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { existsSync, readFileSync } from "fs";

const getTemplate = (tpl: string) => {
	if (existsSync(tpl)) {
		return readFileSync(tpl, "utf-8");
	} else {
		throw new Error(
			`${tpl} not found in this binary, check pkg options and recompile`
		);
	}
};
export const getInventoryTemplate = () => {
	return getTemplate(__dirname + `/../../assets/inventoryTemplate.yaml`);
};

export const getInventoryTemplateMytinydc = () => {
	return `${getInventoryTemplate().replace(/\n*$/, "")}\n${getTemplate(
		__dirname + `/../../assets/inventoryTemplateMytinydc.yaml`
	)}`;
};

export const getManifestBookTemplate = () => {
	return getTemplate(__dirname + `/../../assets/manifestBookTemplate.yaml`);
};

export const getManifestTemplate = () => {
	return getTemplate(__dirname + `/../../assets/manifestTemplate.yaml`);
};

export const getScriptTemplate = () => {
	return getTemplate(__dirname + `/../../assets/scriptTemplate.yaml`);
};

export const genBashAutocompletionTemplate = () => {
	return getTemplate(__dirname + `/../../assets/autocomplete.bash`);
};

export const getInternalBashFunctionsTemplate = () => {
	return getTemplate(__dirname + `/../../assets/internalBashFunctions.bash`);
};
