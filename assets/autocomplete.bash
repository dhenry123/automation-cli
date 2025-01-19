#!/usr/bin/env bash

DEBUG=0
_automation_cli() {
  # COMP_LINE the full command line
  local cur prev opts
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD - 1]}"
  opt="${COMP_WORDS[COMP_CWORD - 2]}"
  opts=""
  if [ "${DEBUG}" == "1" ]; then
    echo ""
    echo "current: ${cur}"
    echo "prev: ${prev}"
    echo "opt: ${opt}"
    echo "COMP_LINE: ${COMP_LINE}"
    echo "OPS ${OPS}"
  fi
  # Ensure OPS is not empty
  opsOperationsDir="${OPS}/operations"
  opsOperationBooksDir="${OPS}/operationBooks"

  if [[ ${prev} == "automation-cli" ]]; then
    opts=$(${prev} --help | awk '/^  [a-zA-Z-]+ / {print $1}' | sed 's/,//g' | xargs)
  else
    if [[ ${prev} == "-op" ]]; then
      if [[ -z "$OPS" ]]; then
        echo "[WARN] You have to export OPS directory before using bash autocompletion"
      else
        opts=$(find "${opsOperationsDir}" -type f -name "manifest.yaml" -print0 | while IFS= read -r -d '' file; do
          part="${file#$opsOperationsDir/}"
          echo "'${part%/*}'"
        done | xargs)
      fi
    elif [[ ${prev} == "-ob" ]]; then
      if [[ -z "$OPS" ]]; then
        echo "[WARN] You have to export OPS directory before using bash autocompletion"
      else
        opts=$(find "${opsOperationBooksDir}" -type f -name "*.yaml" -print0 | while IFS= read -r -d '' file; do
          echo "${file#$opsOperationBooksDir/}"
        done | xargs)
      fi
    elif [[ ${prev} == "run" ]]; then
      opts="'-c' '-op' '-ob'"
    elif [[ ${prev} == "-i" ]]; then
      opts=$(find "${OPS}" -maxdepth 1 -type f -name "*.yaml" -print0 | while IFS= read -r -d '' file; do
        echo "${file#$OPS/}"
      done | xargs)
    elif [[ ${prev} == "audit" ]]; then
      opts="-failed -json"
    elif [[ ${prev} == "catop" ]]; then
      opts="-f -h"
    elif [[ ${prev} == "tree" ]]; then
      opts="--help -dir -fp -d -nc -f -gc -h -i"
    else
      opts="-h -i -eds -edm --help"
    fi
  fi
  COMPREPLY=($(compgen -W "${opts}" -- ${cur}))
}

complete -F _automation_cli automation-cli
