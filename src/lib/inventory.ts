/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { Document, parseDocument } from "yaml";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "fs";
import { dirname } from "path/posix";
//CVE-2024-29415 @todo replace this npm package
import ip from "ip";
import { consoleErr, consoleLog } from "../helpers/helperUI";
import {
	regExpHomeDirectory,
	regExpInventoryKey,
	regExpRelative,
} from "./constants";
import {
	extendProcessEnvWithOperationEnvironment,
	getNestedValue,
	getOPSBasePath,
	realAbsolutePath,
	envSubst,
	setNestedValue,
	removeQuotesFrameString,
} from "./system";
import {
	AnyObject,
	HostsType,
	InventoryContent,
	KeyStringValue,
	VpnConnectionInfos,
} from "./types";
import { logDebugEvent } from "./log";
import { DuplexStream } from "./DuplexStream";
import { emitDataOnStream } from "./run/execOperation";
import { execSync, spawnSync } from "child_process";
import { resolveInventoryFilePath } from "./filePathResolver";
import {
	getInventoryTemplate,
	getInventoryTemplateMytinydc,
} from "./getTemplates";

export const inventoryGetContent = (filePath: string): InventoryContent => {
	let agePublicKey: string | null = null;
	if (filePath.trim() && existsSync(filePath)) {
		const content: string = readFileSync(filePath, "utf-8");

		// check if file is encrypted with sops
		let yamlDoc = parseDocument(content);
		const parsedAsJson = yamlDoc.toJSON();
		if (parsedAsJson && parsedAsJson["sops"]) {
			logDebugEvent(
				`Inventory content seems to be encrypted with SOPS, trying to decrypt`
			);
			agePublicKey = getNestedValue(
				parsedAsJson,
				"sops.age[0].recipient"
			) as string;

			// using sops binary with current SOPS environment - result is redirect to variable
			const decryptedContent = execSync(`sops --decrypt ${filePath}`, {
				env: {
					...process.env,
				},
			});
			// document is parsed from variable content
			yamlDoc = parseDocument(decryptedContent.toString());
			logDebugEvent(
				"Content seems to be decrypted (for security reasons not provided here)"
			);
		}
		return {
			contentEncrypted: parsedAsJson,
			contentDecrypted: yamlDoc,
			agePublicKey: agePublicKey,
		};
	} else {
		throw new Error(
			`${
				filePath.trim()
					? `Inventory file was not found: ${filePath}`
					: `Inventory file not set`
			}`
		);
	}
};

export const inventoryWriteYamlContent = (
	inventoryFile: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	content: any,
	originalYamlInventory?: InventoryContent
): InventoryContent => {
	// create document with original comments
	const newYamlDoc = new Document(content);
	const inventoryFileTemp = `${inventoryFile}.tmp.yaml`;

	try {
		// set original comments
		if (originalYamlInventory)
			newYamlDoc.commentBefore =
				originalYamlInventory.contentDecrypted.commentBefore;
		//Write file - encrypted
		let contentToWrite = newYamlDoc.toString();
		if (originalYamlInventory?.agePublicKey) {
			writeFileSync(inventoryFileTemp, contentToWrite, "utf-8");
			const output = spawnSync("sops", [
				"encrypt",
				"--age",
				originalYamlInventory.agePublicKey,
				inventoryFileTemp,
			]);
			contentToWrite = output.stdout.toString();
			if (existsSync(inventoryFileTemp)) rmSync(inventoryFileTemp);
		}
		writeFileSync(inventoryFile, contentToWrite, "utf-8");

		// Check file is encrypted if original was
		if (originalYamlInventory?.agePublicKey) {
			const check = inventoryGetContent(inventoryFile);
			if (!check.agePublicKey)
				throw new Error(
					`Impossible to continue, Inventory file encryption chain broken`
				);
		}
		return {
			contentDecrypted: newYamlDoc,
			contentEncrypted: contentToWrite,
			agePublicKey: originalYamlInventory?.agePublicKey || null,
		};
	} catch (error) {
		if (existsSync(inventoryFileTemp)) rmSync(inventoryFileTemp);
		throw error;
	}
};

export const inventoryCreate = (
	inventoryFilePath: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	commanderOptions: any
) => {
	const inventoryFileFinalPath = resolveInventoryFilePath(inventoryFilePath);
	const inventoryDirectory = dirname(inventoryFileFinalPath);
	//yaml extension is important for sops
	const inventoryFileTempPath = `${inventoryFileFinalPath}.tmp.yaml`;
	let messageEncrypted = "";
	let inventoryContent = getInventoryTemplate();
	if (commanderOptions.Mytinydc) {
		inventoryContent = getInventoryTemplateMytinydc();
	}
	try {
		// Try to create missing directory, user must be authorized to create files
		if (!existsSync(inventoryDirectory))
			mkdirSync(inventoryDirectory, { recursive: true });
		if (existsSync(inventoryFileFinalPath))
			throw new Error(
				`This inventoryFile already exists: ${inventoryFileFinalPath}`
			);

		// encrypt with sops
		if (commanderOptions.Age) {
			writeFileSync(inventoryFileTempPath, inventoryContent, "utf-8");
			const encryptedContent = execSync(
				`sops encrypt --age "${commanderOptions.Age}" "${inventoryFileTempPath}"`
			);
			if (existsSync(inventoryFileTempPath)) rmSync(inventoryFileTempPath);
			if (encryptedContent) {
				inventoryContent = encryptedContent.toString();
			} else {
				throw new Error(
					"sops was unable to encrypt the contents of the inventory model"
				);
			}
			messageEncrypted = "Encrypted with sops age";
		}
		writeFileSync(inventoryFileFinalPath, inventoryContent, "utf-8");

		if (!commanderOptions.silent)
			consoleLog(
				`\nInventory file has been created in ${inventoryFileFinalPath}${
					messageEncrypted ? ` (${messageEncrypted})` : ""
				}`,
				"green"
			);
	} catch (error) {
		if (existsSync(inventoryFileTempPath)) rmSync(inventoryFileTempPath);
		throw error;
	}
};

export const inventoryGetHostListFromCommanderOptionHosts = (
	commanderOptionHostsList: string[],
	inventoryFile: string | undefined
): HostsType[] => {
	/**
	 * build host lists from commanderOptionHostsList
	 */
	const buildHostsListFromCommanderOptionHostsList = (): HostsType[] => {
		const hostsFromInventory: HostsType[] = [];
		for (const host of commanderOptionHostsList) {
			hostsFromInventory.push({ toPerform: host, userInput: host });
		}
		return hostsFromInventory;
	};

	// inventory file not provided
	if (!inventoryFile) return buildHostsListFromCommanderOptionHostsList();

	const inventoryContent =
		inventoryGetContent(inventoryFile).contentDecrypted.toJSON();

	// inventory file empty or key not present
	if (!inventoryContent || !inventoryContent.serversGroups) {
		throw new Error(
			`You provided an inventory file: ${inventoryFile}, but it does not contain the attribute 'serversGroups' or 'serversGroups' attribute is empty`
		);
	}

	const browseInventoryServersGroups = (hostsList: string[]): HostsType[] => {
		let hostFromInventory: HostsType[] = [];
		for (const host of hostsList) {
			// is  host found as key
			if (
				inventoryContent.serversGroups[host] &&
				Array.isArray(inventoryContent.serversGroups[host])
			) {
				hostFromInventory = hostFromInventory.concat(
					browseInventoryServersGroups(inventoryContent.serversGroups[host])
				);
			} else {
				let finalHost: HostsType = {
					userInput: host,
					toPerform: inventoryContent.serversGroups[host],
				};
				if (
					inventoryContent.serversGroups[inventoryContent.serversGroups[host]]
				) {
					// because of yaml syntax XXXX: YYYYY => YYYY seen as array (could lead user confuse) XXXX: 'YYYYY'
					if (
						Array.isArray(
							inventoryContent.serversGroups[
								inventoryContent.serversGroups[host]
							]
						) &&
						inventoryContent.serversGroups[inventoryContent.serversGroups[host]]
							.length === 1
					) {
						finalHost = {
							userInput: host,
							toPerform:
								inventoryContent.serversGroups[
									inventoryContent.serversGroups[host]
								][0],
						};
					} else {
						finalHost = {
							userInput: host,
							toPerform:
								inventoryContent.serversGroups[
									inventoryContent.serversGroups[host]
								],
						};
					}
				}
				hostFromInventory.push(finalHost);
			}
		}
		// remove duplicate content: https://www.geeksforgeeks.org/how-to-remove-duplicate-elements-from-javascript-array/
		return [...new Set(hostFromInventory)];
	};

	logDebugEvent(
		`Trying to resolve hosts: ${commanderOptionHostsList.join(
			" "
		)} from inventory file: ${inventoryFile}`
	);
	const hostsFromInventory: HostsType[] = [];
	for (const host of commanderOptionHostsList) {
		logDebugEvent(`Trying: ${host}`);
		const result = browseInventoryServersGroups([host]);
		if (host === "all") {
			for (const h of result) {
				hostsFromInventory.push({
					userInput: h.userInput,
					toPerform: h.toPerform,
				});
			}
			break;
		}
		if (result.length === 1) {
			logDebugEvent(
				`${host} resolved as ${JSON.stringify(result[0], null, 4)}`
			);
			if (result[0].toPerform) {
				logDebugEvent(
					`Tolerance: The host ${host} is not included in the inventory, so running the operation on this host may cause issues.`
				);
			}
			hostsFromInventory.push({
				userInput: host,
				toPerform: result[0].toPerform ? result[0].toPerform : host,
			});
		}
	}
	logDebugEvent(
		`Host from inventory: ${JSON.stringify(hostsFromInventory, null, 4)}`
	);
	const finalHostsFromInventory: HostsType[] = [];
	// no duplicate content
	const alreadySet: string[] = [];
	for (const item of hostsFromInventory) {
		if (!alreadySet.includes(item.toPerform)) {
			alreadySet.push(item.toPerform);
			finalHostsFromInventory.push(item);
		}
	}
	return finalHostsFromInventory;
};

const inventoryGetDatacenterNetworkInfos = (datacenterNetwork: string) => {
	if (!datacenterNetwork)
		throw new Error(
			"The contents of the inventory file are inconsistent: it does not include any values for the Datacenter networks."
		);
	const networkInfos = ip.cidrSubnet(datacenterNetwork);
	if (networkInfos) return networkInfos;
	throw new Error(
		`Unable to get the latest address of the network ${datacenterNetwork}`
	);
};

export const isMytinyDCInventory = (content: AnyObject | null): boolean => {
	return !(
		!content ||
		!content.datacenterDescription ||
		(content.datacenterDescription && !content.datacenterDescription.network) ||
		!content.datacenterDescription.domain
	);
};

export const inventoryUpdateFromListening = (
	inventoryFile: string,
	ipAddress: string,
	hostname: string,
	forceAddHost?: string
): boolean => {
	const yamlDoc = inventoryGetContent(inventoryFile);
	const content: AnyObject = yamlDoc.contentDecrypted.toJSON() || {};
	const inventoryFileToDisplay = `file://${inventoryFile}`;
	if (isMytinyDCInventory(content)) {
		const networkInfos: ip.SubnetInfo = inventoryGetDatacenterNetworkInfos(
			content.datacenterDescription.network
		);
		logDebugEvent(
			`inventoryUpdateFromListening: networkInfos: ${JSON.stringify(
				networkInfos
			)}`
		);
		const inventoryKeyServerType = `datacenterDescription.servers.${hostname}.type`;
		const inventoryServerType = getNestedValue(content, inventoryKeyServerType);
		// Type infra
		if (inventoryServerType === "infra") {
			// Could change because external ip is dynamic
			setNestedValue(
				content,
				"datacenterDescription.externalIpAddress",
				ipAddress
			);
			// Internal network
			setNestedValue(
				content,
				"datacenterDescription.internalIpAddress",
				networkInfos.lastAddress
			);
			setNestedValue(
				content,
				"datacenterDescription.internalNetworkBroadcast",
				networkInfos.broadcastAddress
			);
			setNestedValue(
				content,
				"datacenterDescription.internalNetworkSubnetMask",
				networkInfos.subnetMask
			);
			// DHCP
			// First ip of network which could be distributed
			// Latest ip of network which could be distributed
			// This is an arbitrary choice :
			// First ip of the network segment
			// Latest ip of the network segment is reserved for the infra server
			// So the last distributable ip is the last one in the segment less 1.
			// network segment first ip - 1
			setNestedValue(
				content,
				"datacenterDescription.internalDhcpStartingAddress",
				ip.fromLong(ip.toLong(networkInfos.firstAddress))
			);

			// network segment latest ip - 1 => latest is reserved to infra server
			setNestedValue(
				content,
				"datacenterDescription.internalDhcpEndingAddress",
				ip.fromLong(ip.toLong(networkInfos.lastAddress) - 1)
			);

			setNestedValue(
				content,
				"datacenterDescription.hostnameInfraServer",
				hostname
			);

			setNestedValue(
				content,
				`datacenterDescription.servers.${hostname}.externalIpAddress`,
				ipAddress
			);

			setNestedValue(
				content,
				`datacenterDescription.servers.${hostname}.ipAddress`,
				networkInfos.lastAddress
			);
			setNestedValue(
				content,
				`datacenterDescription.servers.${hostname}.hostname`,
				hostname
			);
		} else {
			setNestedValue(
				content,
				`datacenterDescription.servers.${hostname}.hostname`,
				hostname
			);
			setNestedValue(
				content,
				`datacenterDescription.servers.${hostname}.ipAddress`,
				ipAddress
			);
		}
	}
	// default inventory set serversGroups
	if (!content.serversGroups) content.serversGroups = {};
	// not authorized to create:
	// - forceAddHost: not specified by user
	// - forceAddHost: specified by user but hostname doesn't match
	if (!forceAddHost || forceAddHost !== hostname) {
		// Check host exists
		const isAttrExist = typeof content.serversGroups[hostname] !== "undefined";
		if (!isAttrExist) {
			consoleErr(
				`The host: ${hostname} doesn't exist in inventoryFile: ${inventoryFileToDisplay}. Retry with -f "${hostname}" to force adding host in inventory`
			);
			return false;
		}
	}

	setNestedValue(content, `serversGroups.${hostname}`, ipAddress);
	// save inventory
	inventoryWriteYamlContent(inventoryFile, content, yamlDoc);
	consoleLog(
		`inventoryFile: ${inventoryFileToDisplay} has been updated - key: "serversGroups.${hostname}" - value: "${ipAddress}"`,
		"green"
	);
	return true;
};

export const inventoryResolvAttribute = (
	inventoryContent: AnyObject,
	attributeToResolv: string
): string | number | boolean | null | AnyObject => {
	const valueFromInventory = getNestedValue(
		inventoryContent,
		attributeToResolv
	);
	if (["string", "number", "boolean"].includes(typeof valueFromInventory))
		return valueFromInventory;
	return null;
};

export const inventoryRealAbsolutePath = (value: string): string => {
	// Relative
	// start with ~/
	if (regExpHomeDirectory.test(value)) {
		return realAbsolutePath(value);
	}
	// from inventory relative path is from OPS Directory
	if (regExpRelative.test(value))
		return realpathSync(value.replace(/\.\//, `${getOPSBasePath()}/`), "utf-8");
	return value;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const inventorySetSshOption = (commanderOptions: any): boolean => {
	const inventoryContent = inventoryGetContent(
		commanderOptions.inventoryFile
	).contentDecrypted.toJSON();

	if (!inventoryContent?.sshpk) return false;

	commanderOptions.sshPrivateKey = inventoryRealAbsolutePath(
		inventoryContent.sshpk
	);

	logDebugEvent(
		`inventory::inventorySetSshOption value commanderOptions.sshPrivateKey: ${commanderOptions.sshPrivateKey}`
	);
	//building extended environnement to resolve sshPrivateKey
	const extendedEnvironment = extendProcessEnvWithOperationEnvironment(
		commanderOptions.envVar || {}
	);
	commanderOptions.sshPrivateKey = envSubst(
		commanderOptions.sshPrivateKey,
		extendedEnvironment as KeyStringValue //compatible
	);
	//not secure if inventory is not encrypted
	if (inventoryContent?.sshpass)
		commanderOptions.sshPrivateKeyPassPhrase = inventoryContent?.sshpass;
	return true;
};

export const inventoryTryResolvKey = (
	inventoryFile: string,
	key: string,
	stream: DuplexStream
) => {
	let finalValue = key;
	if (inventoryFile && key) {
		try {
			const inventoryContent =
				inventoryGetContent(inventoryFile).contentDecrypted.toJSON();
			if (inventoryContent && regExpInventoryKey.test(key)) {
				finalValue = inventoryResolvAttribute(
					inventoryContent,
					key.replace(regExpInventoryKey, "")
				) as string;
			}
		} catch (error) {
			emitDataOnStream((error as Error).toString(), stream, true);
		}
	}
	return finalValue;
};

/**
 * Wireguard network informations are stored in key internalVpn with some attributs
 * get all attributes
 * if one attribute is missing return null
 */
export const inventoryGetVpnConnectionInfos = (
	inventoryFile: string
): null | VpnConnectionInfos => {
	const inventoryContent =
		inventoryGetContent(inventoryFile).contentDecrypted.toJSON();

	const infosObject: VpnConnectionInfos = {
		wireguardServerAddress: "",
		wireguardServerPort: "",
		wireguardServerPublicKey: "",
		wireguardYourPrivateKey: "",
		wireguardYourIpAddress: "",
		wireguardMatch: "",
	};

	for (const item of Object.getOwnPropertyNames(infosObject)) {
		if (!inventoryContent?.internalVpn || !inventoryContent?.internalVpn[item])
			return null;
		infosObject[item as keyof VpnConnectionInfos] =
			inventoryContent?.internalVpn[item];
	}

	return infosObject;
};

export const resolveInventoryAttributeValue = (
	value: string,
	environment: KeyStringValue,
	inventoryContent: AnyObject
): string | null => {
	// value is : 'TEST' = '#inv.myattribute.key'
	// remove #inv. to keep pure object attributes
	value = removeQuotesFrameString(value.replace(regExpInventoryKey, ""));
	// value is now : 'TEST' = 'inventoryContent.myattribute.key'

	logDebugEvent(
		`resolveInventoryAttributeValue: try to get value for : ${value}`
	);
	// try to interpolate with environment eg : workstation.$host.mykey
	value = envSubst(value, environment);
	logDebugEvent(`resolveInventoryAttributeValue: value interpolated: ${value}`);
	// For security reason eval is not used, preferred is nested value path
	let result = getNestedValue(inventoryContent || {}, value);
	if (!result) result = "";
	if (typeof result === "object") return JSON.stringify(result);
	return result;
};
