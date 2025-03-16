#######################################################
# automation-cli Bash Built-in methods
#######################################################

# Initialize the change_log array
declare -a change_log=()
# Variable used to store the last command executed
last_command=""
previous_command=""

# Function to capture the command before it's executed
capture_command() {
  previous_command="${last_command}"
  last_command="$BASH_COMMAND"
}

# Function to log changes
log_change() {
  change_log+=("Change #${#change_log[@]}: $previous_command")
}

# Function to print all changes
print_changes() {
  if [ ${#change_log[@]} -gt 0 ]; then
    echo "#[C]: Changes made during the script execution:"
    for change in "${change_log[@]}"; do
      while IFS= read -r line; do
        echo "#[C]: $line"
      done <<<"$(echo -e "$change")"
    done
    echo "#[C][TOTAL NUMBER OF CHANGES]:${#change_log[@]}"
  fi
}

# Trap to catch DEBUG signal and capture the command
trap capture_command DEBUG

# Trap to catch EXIT signal and print all changes at the end
trap print_changes EXIT

# Sampling function to demonstrate setting changes
_change() {
  log_change
}

# method to install Debian packages,
# the apt-get finale command only retains packages that are not already installed
function debInstall() {
  export DEBIAN_FRONTEND="noninteractive"
  if [ "$1" != "" ]; then
    #Check is installed
    local toInstall=""
    set +e
    # case status is: deinstall ok config-files
    for P in $1; do
      res=$(dpkg -s "$P" 2>/dev/null)
      if [ "$?" != "0" ] || echo "$res" | grep "deinstall ok" >/dev/null 2>&1; then
        toInstall="${toInstall} $P"
      fi
    done
    set -e
    toInstall=$(echo "${toInstall}" | xargs)
    sudoPrefix=""
    if [ "$(id -u)" != "0" ]; then
      sudoPrefix="sudo"
    fi
    if [ "$toInstall" != "" ]; then
      # to prevent this kind of error :
      # Warning: The unit file, source configuration file or drop-ins of ???? changed on disk. Run 'systemctl daemon-reload' to reload units
      $sudoPrefix systemctl daemon-reload
      # Sometimes, some repositories are not accessible and exit due to the use of set -e in the main shell.
      set +e
      $sudoPrefix apt-get -q update
      # ReApply
      set -e
      # No quote, otherwise it will consider the contents as a single package.
      $sudoPrefix apt-get -qy install ${toInstall}
      _change
    fi
  fi
}

# Method for detecting whether automation can be applied on the server?
function checkIsServerProtected() {
  if [ -f "##markProtectedServer##" ]; then
    echo "##markProtectedServerMessageLine1##"
    echo "##markProtectedServerMessageLine2##"
    exit 2
  fi
}

# Method for building a basic JSON structure with a few 'key:value' elements.
function _jsonOutput() {
  declare -n arr=$1
  json="{"
  for key in "${!arr[@]}"; do
    value="${arr[$key]}"
    json+="\"$key\":\"$value\","
  done
  json="${json%,}}"
  echo "${json}"
}

# Wrappers for messages
function _info() {
  echo "[INFO] $1"
}

function _warn() {
  echo "[WARN] $1"
}

function _error() {
  echo "[ERROR] $1" >&2
}
