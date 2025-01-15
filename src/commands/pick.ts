import { basename } from "path";
import { FileType, OpenDialogOptions, QuickPickItem, Uri, window, workspace } from "vscode";
import { RPartial } from "../common";
import showQuickPick = window.showQuickPick;
import showOpenDialog = window.showOpenDialog;
import fs = workspace.fs;
import { TextDecoder } from "util";
import { stringify } from "querystring";

type Options = Omit<OpenDialogOptions, "defaultUri" | "filters"> & {
  path?: string;
  native: boolean;
  canSelectFiles: boolean;
  canSelectFolders: boolean;
  canChangeFolder: boolean;
  canSelectMany: boolean;
  filterRegExp?: string;
  filterExt?: string;
  defaultInputPath?: string
  defaultWorkspace?: string
  defaultEnvFile?: string
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
    ? await pickWithNative(await resolvePath(options.defaultWorkspace,options.defaultInputPath, options.defaultEnvFile,options.path), options)
    : await pickWithQuick(await resolvePath(options.defaultWorkspace, options.defaultInputPath, options.defaultEnvFile, options.path) ?? Uri.parse(""), options);

  if (uris != null) {
    return formatUris(uris, output);
  }
  if (output.default != null) {
    return output.default;
  }
  if (output.defaultPath != null) {
    const defaultUri = await resolvePath(options.defaultWorkspace, options.defaultInputPath, options.defaultEnvFile, output.defaultPath);
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

function resolveEnvPath(filePath: string, defaultWorkspace?: string): Uri | undefined {
  const workspaceFolders = workspace.workspaceFolders;
  
  
  if (filePath.startsWith("/")) {
    return Uri.parse(filePath);
  }
    
  if (filePath == null) {
    if ((workspaceFolders?.length ?? 0) >= 1) {
      return workspaceFolders![0].uri;
    }
  }

  if (workspaceFolders?.length === 1) {
    return Uri.joinPath(workspaceFolders[0].uri, filePath!);
  }

  const defaultPath = Uri.parse(filePath!).path;
  const workspaceFolder = workspaceFolders?.find((f) => {
    return defaultPath.startsWith(basename(f.uri.path) + "/");
  });
  if (workspaceFolder != null) {
    return Uri.joinPath(workspaceFolder.uri, filePath!);
  }

  if (defaultWorkspace) {
    const workspaceFolder = workspaceFolders?.find((f) => {
      return  f.name == defaultWorkspace
    });

    if (workspaceFolder != null) {
      return Uri.joinPath(workspaceFolder.uri, filePath!);
    }
  }

  return 
}

function parseEnvContent(envContent: string): Map<string, string> {
  const envMap = new Map<string, string>();

  // Split the content into lines
  const lines = envContent.split(/\r?\n/);

  for (const line of lines) {
    // Ignore empty lines or lines starting with a comment
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }

    // Split the line into key and value
    const [key, ...valueParts] = line.split('=');
    if (key) {
      const value = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); // Remove surrounding quotes
      envMap.set(key.trim(), value);
    }
  }

  return envMap;
}


async function readWorkspaceFile(filePath: string, defaultWorkspace?: string): Promise<string> {
  try {

    let uri = resolveEnvPath(filePath, defaultWorkspace)

    const fileContent = await fs.readFile(uri!);
    const content = new TextDecoder('utf-8').decode(fileContent);
    return content;
  } catch (error) {
    console.log('file-pick-pro:', error);
    return  '';
  }
}



async function resolvePath(defaultWorkspace: string| undefined, defaultInputPath: string | undefined, defaultEnvFile: string | undefined, path: string | undefined): Promise<Uri | undefined> {
  const workspaceFolders = workspace.workspaceFolders;

  if (path == null) {
    if ((workspaceFolders?.length ?? 0) >= 1) {
      return workspaceFolders![0].uri;
    }
    return;
  }

  path =  await resolveEnvVariables(path, defaultEnvFile, defaultWorkspace );

  if (path.startsWith("/")) {
    return Uri.parse(path);
  }

  if (defaultInputPath && (path === '' || path === undefined)){
      path = defaultInputPath;
  }

  if (workspaceFolders?.length === 1) {
    return Uri.joinPath(workspaceFolders[0].uri, path!);
  }

  const defaultPath = Uri.parse(path!).path;
  const workspaceFolder = workspaceFolders?.find((f) => {
    return defaultPath.startsWith(basename(f.uri.path) + "/");
  });
  if (workspaceFolder != null) {
    return Uri.joinPath(workspaceFolder.uri, path!);
  }

  if (defaultWorkspace) {
    const workspaceFolder = workspaceFolders?.find((f) => {
      return  f.name == defaultWorkspace
    });

    if (workspaceFolder != null) {
      return Uri.joinPath(workspaceFolder.uri, path!);
    }
  }

  return;
}


async function resolveEnvVariables( path?: string, defaultEnvFile?: string, defaultWorkspace?: string): Promise<string> {

  if (!path) {
    return ''
  }

  let envMap = new Map<string, string>();

  if (defaultEnvFile) {
    let envFileContent = await readWorkspaceFile(defaultEnvFile, defaultEnvFile);

    envMap = parseEnvContent(envFileContent);
  }

  return path.replace(/\$\{env:\s*([\w_]+)\}/g, (_, variableName) => {

    let value: string | undefined = undefined;

    if(envMap.has(variableName)) {
      value = envMap.get(variableName)!;
    } else {
       value = process.env[variableName];
    }

    return value !== undefined ? value : '';
  });

}

function formatUris(uris: Uri[] | undefined, output: FullParam["output"]): string | undefined {
  return uris?.map((uri) => (output.fsPath ? uri.fsPath : uri.path)).join(output.join);
}