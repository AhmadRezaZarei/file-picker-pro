# Launch File Picker

The file (or directory) path picker for `launch.json` and `tasks.json`.

## How to use

1. Add item to `inputs` field in `launch.json` or `tasks.json` like this. ([more info for `inputs`](https://code.visualstudio.com/docs/editor/variables-reference#_input-variables)).
   ```jsonc
   {
      "id": "pickSingleFile",
      "type": "command",
      "command": "launch-file-picker.pick",
      "args": ".envs", // (optional) The directory the dialog shows when opened.
   }
   ```
1. use variable `${input:<input-id>}` in `configurations` or `tasks` items like this.
   ```jsonc
   {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}\\app.js",
      "envFile": "${input:pickEnvFile}" // This!
   }
   ```

## Options

```jsonc
"args": string, // The directory the dialog shows when opened.
```
or
```jsonc
"args": {
  "options": {
    "path": string, // The directory the dialog shows when opened. If a relative path is specified, it will be resolved. (Defaults to workspace's root)
    "canSelectFiles": boolean, // Allow to select files, defaults to `true`. (Defaults to true)
    "canSelectFolders": boolean, // Allow to select folders, defaults to `false`. (Defaults to false)
    "canChangeFolder": boolean, // Allow to select files from different folder than `defaultPath`. (Default to false)
    "canSelectMany": boolean, // Allow to select many files or folders. (Defaults to false)
    "filterRegExp": string, // Regular expressions that work as filters. (Defaults to null)
    "filterExt": string, // File extensions that work as filters. (e.g. `.ts`. Default to null)
    "title": string, // Dialog title. (Defaults to null)
    "native": boolean, // Whether open native file manoger. (Default: false)
  },
  "output": {
    "join": string, // path separator for `options.canSelectMany` is true. (Defaults to ",")
    "fsPath": boolean, // The string representing the corresponding file system path of this Uri. (e.g. in windown output is `\\server\c$\folder\file.txt`. Defaults to true)
    "defaultPath": string, // Control whether output path if nothing is selected. If a relative path is specified, it will be resolved. (Defaults to null)
    "default": string, // Control whether output text if nothing is selected. (Defaults to null)
  },
}
```

## Example

Select env file in launch.json:

```jsonc
{
  "version": "0.2.0",
  "configurations": [
   {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}\\app.js",
      "envFile": "${input:pickEnvFile}"
    }
  ],
  "inputs": [
    {
      "id": "pickEnvFile",
      "type": "command",
      "command": "launch-file-picker.pick",
      "args": {
        "options": {
          "title": "pick env file",
          "path": "client/env",
          "filterExt": ".env"
        },
        "output": {
          "defaultPath": "client/env/dev.env"
        }
      }
    }
  ]
}
```

Select a file from HOME in launch.json:

```jsonc
{
  "version": "0.2.0",
  "configurations": [
   {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}\\app.js",
      "envFile": "${input:pickAFile}"
    }
  ],
  "inputs": [
    {
      "id": "pickAFile",
      "type": "command",
      "command": "launch-file-picker.pick",
      "args": {
        "options": {
          "title": "pick a file",
          "path": "${env: HOME}",
        }
      }
    }
  ]
}
```