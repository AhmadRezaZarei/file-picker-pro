import { basename } from "path";
import { FileType, OpenDialogOptions, QuickPickItem, Uri, window, workspace } from "vscode";
import { RPartial } from "../common";
import showQuickPick = window.showQuickPick;
import showOpenDialog = window.showOpenDialog;
import fs = workspace.fs;

type Options = Omit<OpenDialogOptions, "defaultUri" | "filters"> & {
  path?: string;
  native: boolean;
  canSelectFiles: boolean;
  canSelectFolders: boolean;
  canChangeFolder: boolean;
  canSelectMany: boolean;
  filterRegExp?: string;
  filterExt?: string;
  defaultEnvFilePath?: string
};

type FullParam = {
  options: Options;
  output: {
    join: string;
    fsPath: boolean;
    defaultPath?: string;
    default?: string;
  };
};

type Param = string | RPartial<FullParam>;

export async function pickHandler(args?: Param): Promise<string | undefined> {
  const { options, output } = parseArgs(args);

  const uris = options.native
    ? await pickWithNative(resolvePath(options.defaultEnvFilePath,options.path), options)
    : await pickWithQuick(resolvePath(options.defaultEnvFilePath, options.path) ?? Uri.parse(""), options);

  if (uris != null) {
    return formatUris(uris, output);
  }
  if (output.default != null) {
    return output.default;
  }
  if (output.defaultPath != null) {
    const defaultUri = resolvePath(options.defaultEnvFilePath, output.defaultPath);
    const formated = defaultUri != null ? formatUris([defaultUri], output) : undefined;
    return formated ?? output.defaultPath;
  }
}

function parseArgs(param?: Param): FullParam {
  const defaultParam: FullParam = {
    options: {
      native: false,
      canSelectFiles: true,
      canSelectFolders: false,
      canChangeFolder: false,
      canSelectMany: false,
    },
    output: { join: ",", fsPath: true },
  };

  if (typeof param === "string") {
    return {
      ...defaultParam,
      options: { ...defaultParam.options, path: param },
    };
  }

  return {
    ...defaultParam,
    ...param,
    options: { ...defaultParam.options, ...param?.options },
    output: { ...defaultParam.output, ...param?.output },
  };
}

async function pickWithNative(
  dir: Uri | undefined,
  options: FullParam["options"]
): Promise<Uri[] | undefined> {
  return await showOpenDialog({ ...options, defaultUri: dir });
}

async function pickWithQuick(dir: Uri, options: FullParam["options"]): Promise<Uri[] | undefined> {
  const {
    filterExt: ext,
    filterRegExp: regx,
    canSelectFiles,
    canSelectFolders,
    canChangeFolder,
    canSelectMany,
    title,
  } = options;

  dir = Uri.joinPath(dir, ".");
  const children = await fs.readDirectory(dir);
  type Item = QuickPickItem & { uri: Uri; type: FileType };

  const res = await showQuickPick<Item>(
    [
      ...(canChangeFolder ? [["..", FileType.Directory] as [string, FileType]] : []),
      ...(canSelectFolders ? [[".", FileType.Directory] as [string, FileType]] : []),
      ...children,
    ]
      .map(([name, type]) => ({ uri: Uri.joinPath(dir, name), name, type }))
      .filter((e) => e.type === FileType.Directory || regx == null || RegExp(regx).test(e.uri.path))
      .filter((e) => e.type === FileType.Directory || ext == null || e.uri.path.endsWith(ext))
      .filter(({ type }) => type !== FileType.Directory || canSelectFolders || canChangeFolder)
      .filter(({ type }) => type !== FileType.File || canSelectFiles)
      .map((e) => ({ ...e, label: e.type === FileType.Directory ? `${e.name}/` : e.name })),
    { title: title, canPickMany: canSelectMany }
  );

  if (res == null) {
    return;
  }
  const items = Array.isArray(res) ? (res as Item[]) : [res];
  if (
    canChangeFolder &&
    items.length === 1 &&
    items[0].type === FileType.Directory &&
    items[0].uri.path !== dir.path
  ) {
    return pickWithQuick(items[0].uri, options);
  }
  return items.map((i) => i.uri);
}

function resolvePath(defaultEnvFilePath: string | undefined, path: string | undefined): Uri | undefined {
  const workspaceFolders = workspace.workspaceFolders;

  if (path == null) {
    if ((workspaceFolders?.length ?? 0) >= 1) {
      return workspaceFolders![0].uri;
    }
    return;
  }

  path =  resolveEnvVariables(defaultEnvFilePath,path)

  if (path.startsWith("/")) {
    return Uri.parse(path);
  }

  if (workspaceFolders?.length === 1) {
    return Uri.joinPath(workspaceFolders[0].uri, path);
  }

  const defaultPath = Uri.parse(path).path;
  const workspaceFolder = workspaceFolders?.find((f) =>
    defaultPath.startsWith(basename(f.uri.path) + "/")
  );
  if (workspaceFolder != null) {
    return Uri.joinPath(workspaceFolder.uri, path);
  }

  return;
}


function resolveEnvVariables(defaultEnvFilePath ?:string, path?: string): string {

  if (!path) {
    return ''
  }

  return path.replace(/\$\{env:\s*([\w_]+)\}/g, (_, variableName) => {

    // check if the variable is defined in the environment


    const value = process.env[variableName];
    return value !== undefined ? value : '';
  });

}

function formatUris(uris: Uri[] | undefined, output: FullParam["output"]): string | undefined {
  return uris?.map((uri) => (output.fsPath ? uri.fsPath : uri.path)).join(output.join);
}