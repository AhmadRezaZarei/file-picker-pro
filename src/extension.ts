import * as vscode from "vscode";
import { pickHandler } from "./commands/pick";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("file-picker-pro.pick", pickHandler)
  );
}

export function deactivate() {}
