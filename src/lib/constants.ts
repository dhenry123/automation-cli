/**
 * @author: Damien HENRY
 * @license: AGPL-3
 * reviewed on 11/08/24
 */

export const APPLICATION_VERSION = "20.0.42";

// Listening port receiving broadcast message from infra
export const defaultIPortDiscoverInfra: number = 49125;

export const logDirectory = "automation-cli.logs";
export const LogDebugFileName = "automation-cli-debug.log";
export const LogCommonFileName = "automation-cli-common.log";

// Relative path detected
export const regExpRelative = /^\.\//;
// Relative path detected
export const regExpAbsolute = /^\//;
export const regExpChangeAll = /^#\[C\]/;
export const regExpChangeTotal = /^#\[C\]\[.*\]:(\d*)/;
export const regExpHomeDirectory = /^~/;
// yaml filename extension is .yaml for this project
export const regExpYamlExtentionFilename = /\.yaml$/;
export const regExpInventoryKey = /^#inv\./;
export const regSudoPassword = /^\[sudo\] password for .*:/;
export const regBashVariable = /\$([A-Za-z0-9_]+)/;
export const regBashVariableExtended = /\$\{([A-Za-z0-9_]+)\}/;

export const messageNotYamlFilePath =
	"The value of the 'operationBook' attribute must be a yaml file name (e.g. mybook.yaml).";

export const messageCanceledByUser = "Canceled by user";

export const messageProcessCanceledByUser = `\nProcess ${messageCanceledByUser}`;

export const messageNumberOfOperations = "Number of operations";

export const messageExitWithOutputOnStdErr = `\n[WARN] This operation ended with the exitCode: 0, but some messages were redirected to the 'stderr' output.\n
This may be due to :
- the program sending warning informations on the 'stderr' output
- OR a programming error
- OR your system's inability to distinguish between stderr and stdout output.
You can try to resolve the issue by detecting the command in question and following it up with:
"2>/dev/null" if you don't want to display error
or
"2>&1" to redirect error to stdout

Check the log file for '**shellStdErr**:'
`;
// legacy operation directories storage - no trailing /
export const legacyDirStorage = "/var/lib/automation-cli";
export const legacyDirStorageOperations = `${legacyDirStorage}/operations`;
export const legacyDirStorageOperationBooks = `${legacyDirStorage}/operationBooks`;

export const sshDefaultPrivateKeyFiles = [
	"id_dsa",
	"id_ecdsa",
	"id_ecdsa_sk",
	"id_ed25519",
	"id_ed25519_sk",
	"id_rsa",
];

export const netWorkV4PrivateNetworksRanges = [
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
];

// Wording

export const word_OperationBook_manifest_file = "OperationBook manifest file";
export const word_Operation_manifest_file = "Operation manifest file";

// builtin methods - starts with # which is the comment mark for bash - no conflict with binary name possible
export const builtinMethods = [
	"#waitForServerRestart",
	"#isPrivateCidrNetwork",
	"#isCidrNetwork",
	"#updateInventory",
	"#confirm",
];

export const markProtectedServer = "/mytinydc-runtime-protection.lock";
export const markProtectedServerMessageLine1 =
	"This server is protected against 'automation-cli' operations.";
export const markProtectedServerMessageLine2 =
	"To perform an 'operation' on this server, delete the file ##markProtectedServer##";

export const typeEnvironmentVariable: string[] = [
	"string",
	"number",
	"boolean",
];

export const obfuscationString = "'hidden content'";
export const prefixCommonLog = "Wireguard VPN::";

// Number of hours before automation-cli automatically shuts down without activity (hours in minutes)
export const MINUTESNOACTIVITYBEFORESHUTDOWN = 2 * 60;

export const linuxLevelLogger = "local6.debug";
export const linuxTagLogger = "automation-cli";
