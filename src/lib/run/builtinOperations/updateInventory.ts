/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 12/07/2024
 */

import { DuplexStream } from "../../DuplexStream";
import {
	inventoryGetContent,
	inventoryWriteYamlContent,
} from "../../inventory";
import {
	removeQuotesFrameString,
	envSubst,
	setNestedValue,
	getNestedValue,
} from "../../system";
import { ExecBuiltinOperationParameters } from "../../types";
import { emitDataOnStream } from "../execOperation";

/**
 * SIMPLE method to update inventory yaml file from yaml operation
 * NO COMPLEXITY, so no complex data structure
 * simple syntax covered : key=value
 * key and value could contain shell environment variable notation which will be substute
 */
export const builtinUpdateInventory = async (
	parameters: ExecBuiltinOperationParameters,
	stream: DuplexStream
) => {
	if (
		parameters.values &&
		Array.isArray(parameters.values) &&
		parameters.values.length > 0
	) {
		// Get inventory content
		const yamlDoc = inventoryGetContent(parameters.inventoryFile);

		const content = yamlDoc.contentDecrypted.toJSON();

		let modified = false;
		const updatedAttributes: string[] = [];
		for (const line of parameters.values) {
			if (typeof line !== "string") {
				stream.emit("close", new Error(`Values item must be string type`));
				return;
			}
			// To update inventory we need key=value
			const expl = (line as string).split("=");
			// split line to get key expl[0] and value expl[1]
			if (expl.length !== 2) {
				stream.emit(
					"close",
					new Error(
						`The value provided is malformed: ${line}, syntax is 'key=value' (only one =)`
					)
				);
				return;
			}

			// --->try to resolve key with environment
			// eg: key.key1.$ENVAR.key2 with ENVAR="test" => key.key1.test.key2
			// and key.key1 = $ENVAR.jsonkey with $ENVAR='{"jsonkey":"jsonvalue"}
			// inventoryKey
			try {
				const inventoryKey = removeQuotesFrameString(
					envSubst(expl[0], parameters.environment, true)
				);
				// Value could be $ENV.attribut.attribut...
				const items = expl[1].split(".");
				let inventoryValue = "";
				// Default is the first item
				let keyValue = items[0] || "";
				let varName = "";
				// Detect environment variable only one
				for (const item of items) {
					if (/\$\{([A-Za-z0-9_]+)\}|\$([A-Za-z0-9_]+)/g.test(item)) {
						keyValue = envSubst(item, parameters.environment, true);
						varName = item;
						break;
					}
				}
				if (items.length > 1) {
					const pathAttr = items.filter((e) => e != varName).join(".");
					try {
						const parsed = JSON.parse(keyValue);
						inventoryValue = removeQuotesFrameString(
							getNestedValue(parsed, pathAttr) as string
						);
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
					} catch (err) {
						throw new Error(
							`You're asking to extract key ${pathAttr} fron a string which not formated as JSON: ${keyValue}`
						);
					}
				} else {
					inventoryValue = removeQuotesFrameString(keyValue);
				}
				setNestedValue(content, inventoryKey, inventoryValue);
				updatedAttributes.push(`${inventoryKey}: ${inventoryValue}`);
				modified = true;
			} catch (error) {
				stream.emit(
					"close",
					new Error(
						`Impossible to update the inventory attribute: ${expl[0]} - ${
							expl[1]
						} - Last Error was: ${(
							error as Error
						).toString()}. If error is related to environment, retry adding parameter: -e ${
							expl[1]
						}="\${ENVVAR} | $ENVAR"`
					)
				);
				return;
			}
		}
		// save new inventory content
		if (modified) {
			inventoryWriteYamlContent(parameters.inventoryFile, content, yamlDoc);
			emitDataOnStream(
				`[INFO] ${parameters.inventoryFile} has been updated`,
				stream,
				false
			);
		}
		stream.emit("close");
		return;
	} else {
		stream.emit(
			"close",
			new Error(
				"The inventory has NOT been updated, because operation doesn't include attribute 'values'. eg: value:\n  key1.key2.key3=[value which could be environment variable name]"
			)
		);
		return;
	}
};
