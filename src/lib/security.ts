/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import {
	regExpInventoryKey,
	regBashVariableExtended,
	regBashVariable,
	linuxLevelLogger,
	linuxTagLogger,
} from "./constants";

/**
 * check if value doesn't contain Bash variable or inventory tag, if not => pure string, could not be display everywhere !!!
 * e.g.: obaddop
 * @param value
 */
export const securityValueIsPureString = (value?: string) => {
	if (!value) return true;
	if (regExpInventoryKey.test(value)) return true;
	return regBashVariableExtended.test(value) || regBashVariable.test(value);
};

export const linuxLoggerCommand = (instructions: string) => {
	return `logger -p '${linuxLevelLogger}' -t '${linuxTagLogger}' '[${process.env.USER}] operation : ${instructions}'`;
};

export const logHideInformations = (data: string) => {
	// hide sudo password
	return data.replace(/(.*<<< *').*('.*)/, "$1*****$2");
};
