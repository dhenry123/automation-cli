/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 30/01/25
 */

import { ChildProcessWithoutNullStreams } from "child_process";
import MiniSearch from "minisearch";
import { Client } from "ssh2";
import { Document } from "yaml";

export type HostsType = {
	toPerform: string;
	userInput: string;
	toPerformOverWireguardVpn?: string;
};

export type KeyStringValue = {
	[key: string]: string;
};

export type KeyNumberValue = {
	[key: string]: number;
};

export type KeyStringNumberValue = {
	[key: string]: string | number;
};

export type KeyStringNumberBooleanValue = {
	[key: string]: string | number | boolean;
};

export type ManifestParameterType = {
	type: string;
	comment?: string;
	default?: string;
};

export type OperationCatalogItemType = {
	operation: string;
	path: string;
	type: string;
	comment: string;
	scripts: string[];
	environment: {
		required: string[];
		optional: string[];
	};
	limitHosts: string[];
	when: string;
	error: string;
};

export type ManifestRequiredParameters = {
	[key: string]: ManifestParameterType;
};

export type ManifestOptionalParameters = {
	[key: string]: ManifestParameterType;
};

export type ManifestParametersType = {
	required?: ManifestRequiredParameters;
	optional?: ManifestOptionalParameters;
};

export type OperationType = "command" | "operation" | "operationBook";

export type OperationBase = {
	name: string;
	operationType: OperationType;
	value: string;
	environmentFromCommanderOption?: string[];
	register: string;
	nolog: boolean;
	when: string;
	limitHosts?: string[];
};
/**
 * Operation Object
 * extract from operation manifest file
 * OR
 * built for command operation
 */
export type Operation = {
	name: string;
	command?: string;
	operation?: string;
	operationBook?: string;
	script?: string[]; // Compatibility old manifests : will be removed in the future
	scripts?: string[];
	book?: string;
	dependencies?: string[];
	comment?: string;
	limitHosts?: string[];
	environment?: KeyStringValue; // [ "TEST=1234", TOTO="ABED"]
	copyTo?: CopyTo[];
	/**
	 * parameters: parameters environment variables in manifest
	 * Within operation manifest: ManifestParametersType
	 * within operation book: KeyStringValue
	 */
	parameters?: ManifestParametersType | KeyStringValue;
	register?: string;
	values?: (string | KeyStringNumberValue)[];
	nolog?: boolean;
	when?: string;
};

export type ShellDescription = {
	shellInstructions: string;
	tmpFile: string | null;
	timeToBuild: number; // in milliseconds
	error?: string;
};

export type ExecOperationHostErrorType = {
	host: string;
	operationError?: string;
};

export type ExecOperationPromiseType = {
	connexion: Client | ChildProcessWithoutNullStreams | null;
	operation: Operation;
	host: HostsType;
	error?: Error | null;
};

export type ManifestRunnableType = {
	operations: Operation[];
	parameters?: string[];
	environment?: string[];
};

export type VpnConnectionInfos = {
	wireguardServerAddress: string;
	wireguardServerPort: string;
	wireguardServerPublicKey: string;
	wireguardYourPrivateKey: string;
	wireguardYourIpAddress: string;
	wireguardMatch: string;
};

export type CopyTo = { src: string; dest: string; chmod?: string };

export type ExecBuiltinOperationParameters = {
	hostToPerform: string;
	inventoryFile: string;
	environment: KeyStringValue;
	values?: (string | KeyStringNumberValue)[];
	options?: unknown;
	nolog?: boolean;
	when?: string;
	limitHosts?: string[];
	copyTo?: CopyTo[];
};

export type ShellOutput = {
	output: "stdout" | "stderr";
	message: string;
};

export type RequiredAndMissingParameters = {
	environmentVariableName: string;
	operationName: string;
	idxOperationInList: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObject = { [key: string]: any };

export type BuiltinValuesToObject = {
	host: string;
	port: number; // common
	timeoutServerOffline: number; // waitForServiceRestart
	timeoutServerOnline: number; // waitForServiceRestart
};

export type InventoryContent = {
	contentDecrypted: Document;
	contentEncrypted: string;
	agePublicKey: string | null;
};

export type IndexOperationParametersStruct = {
	name: string;
	comment: string;
};
export type IndexOperationStruct = {
	id: string;
	name: string;
	comment: string;
	parametersRequired: IndexOperationParametersStruct[];
	parametersOptional: IndexOperationParametersStruct[];
};

export type MiniSearchIndex = {
	index: MiniSearch<unknown>;
	executedInMs: number;
};

export type OperationStructForSelectPrompt = {
	manifest: string;
	comment: string;
};

export type ReportOperationDependenciesLine = {
	manifest: string;
	operationName: string;
	dependencies: string[];
};

export type SecurityAuditResult = {
	type: string;
	path: string;
	warning: string[];
	shortcut?: string;
};
