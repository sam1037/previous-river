import { App, TFile } from "obsidian";
import { Notice, getLinkpath } from "obsidian";
import { moment } from "obsidian";
import { extractLinktext } from "./utils";
import { MyPluginSettings } from "./settings";

/**
 * Get the currently active file.
 */
export function getActiveFile(app: App): TFile | null {
  return app.workspace.getActiveFile();
}

/**
 * Retrieve the `previous` linkpath from the file's frontmatter.
 * @returns Extracted linkpath from the `previous` property, or null if not found.
 */
export function getPreviousLinkpath(app: App, file: TFile): string | null {
  const cache = app.metadataCache.getFileCache(file);
  const previousName = cache?.frontmatter?.previous;

  if (!previousName?.includes("[[")) {
    return null;
  }

  return getLinkpath(extractLinktext(previousName));
}

/**
 * Determine if a file is daily note
 */
export function isDailyNote(
  file: TFile,
  dailyNoteFormat: string,
  folderPath: string,
): boolean {
  return (
    file.parent?.path === folderPath &&
    moment(file.basename, dailyNoteFormat, true).isValid()
  );
}

/**
 * Determine if a file is a weekly note
 */
export function isWeeklyNote(
  file: TFile,
  weeklyNoteFormat: string,
  folderPath: string,
): boolean {
  return (
    file.parent?.path === folderPath &&
    moment(file.basename, weeklyNoteFormat, true).isValid()
  );
}

/**
 * Helper to find adjacent periodic notes (daily/weekly).
 */
// TODO use metadata cache approach instead of this linear scan with limit approach (see periodic notes plugin)
function findAdjacentPeriodicNote(
  app: App,
  file: TFile,
  format: string,
  direction: 1 | -1,
  unit: "days" | "weeks",
  limit: number,
): TFile | null {
  let searchDate = moment(file.basename, format).add(direction, unit);
  const currentFilePath = file.path;

  for (let i = 0; i < limit; i++) {
    const target = app.metadataCache.getFirstLinkpathDest(
      searchDate.format(format),
      currentFilePath,
    );
    if (target) return target;
    searchDate.add(direction, unit);
  }
  return null;
}

/**
 * Retrieve the previous note based on the `previous` property in the frontmatter.
 */
export function getPreviousNote(
  app: App,
  file: TFile,
  settings: MyPluginSettings,
): TFile | null {
  const previousLinkpath = getPreviousLinkpath(app, file);
  if (!previousLinkpath) {
    // handle daily note nav
    if (
      settings.enableDailyNoteNav &&
      isDailyNote(file, settings.dailyNoteFormat, settings.dailyFolder)
    ) {
      return findAdjacentPeriodicNote(
        app,
        file,
        settings.dailyNoteFormat,
        -1,
        "days",
        365,
      );
    }
    // handle weekly note nav
    if (
      settings.enableWeeklyNoteNav &&
      isWeeklyNote(file, settings.weeklyNoteFormat, settings.weeklyFolder)
    ) {
      return findAdjacentPeriodicNote(
        app,
        file,
        settings.weeklyNoteFormat,
        -1,
        "weeks",
        52,
      );
    }
    return null;
  }

  const target = app.metadataCache.getFirstLinkpathDest(
    previousLinkpath,
    file.path,
  );

  if (!target) {
    new Notice(`Note "${previousLinkpath}" was not found.`);
    return null;
  }

  return target;
}

/**
 * Retrieve notes that list the current file as their `previous` note.
 */
export function getNextNotes(
  app: App,
  file: TFile,
  settings: MyPluginSettings,
): TFile[] {
  const currentPath = file.path;
  const backlinks = app.metadataCache.resolvedLinks;
  const nextNotes: TFile[] = [];

  for (const [sourcePath, targets] of Object.entries(backlinks)) {
    // Check if the source note links to the current note.
    if (!targets[currentPath]) {
      continue;
    }

    const targetFile = app.vault.getAbstractFileByPath(sourcePath);
    if (!(targetFile instanceof TFile)) {
      continue;
    }

    const previousLinkText = getPreviousLinkpath(app, targetFile);
    if (!previousLinkText) {
      continue;
    }

    // Add only if the `previous` field points to the current note.
    if (
      previousLinkText === file.basename ||
      previousLinkText === currentPath
    ) {
      nextNotes.push(targetFile);
    }
  }

  // handle daily note implicit next notes
  if (
    settings.enableDailyNoteNav &&
    isDailyNote(file, settings.dailyNoteFormat, settings.dailyFolder)
  ) {
    const nextDailyNote = findAdjacentPeriodicNote(
      app,
      file,
      settings.dailyNoteFormat,
      1,
      "days",
      365,
    );
    if (nextDailyNote != null && !nextNotes.includes(nextDailyNote)) {
      nextNotes.push(nextDailyNote);
    }
  }

  // handle weekly note implicit next notes
  if (
    settings.enableWeeklyNoteNav &&
    isWeeklyNote(file, settings.weeklyNoteFormat, settings.weeklyFolder)
  ) {
    const nextWeeklyNote = findAdjacentPeriodicNote(
      app,
      file,
      settings.weeklyNoteFormat,
      1,
      "weeks",
      365,
    );
    if (nextWeeklyNote != null && !nextNotes.includes(nextWeeklyNote)) {
      nextNotes.push(nextWeeklyNote);
    }
  }

  return nextNotes;
}
