import { App, TFile } from "obsidian";
import { Notice, getLinkpath } from "obsidian";
import { moment } from 'obsidian';
import { extractLinktext } from "./utils";
import { MyPluginSettings } from "./settings"

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
 * Determine if a file is daily note given it's basename
 */
export function isDailyNote(fileBasename: string, dailyNoteFormat: string): boolean {
  return moment(fileBasename, dailyNoteFormat, true).isValid(); 
}

// TODO use metadata cache approach instead of this linear scan with limit approach, 
// TODO refactor the following 2 functions into sth like findAdjDailyNote with direction para
// ? do i want to move these 2 functions to the utils.ts file?
export function getPreviousDailyNote(app: App, file: TFile, dailyNoteFormat: string): TFile | null {
  const maxDaysToSearch = 365;
  let searchDate = moment(file.basename, dailyNoteFormat).subtract(1, 'days');
  const currentFilePath = file?.path || "";
  
  for (let i =0; i< maxDaysToSearch; i++) {
    const target = app.metadataCache.getFirstLinkpathDest(searchDate.format(dailyNoteFormat), currentFilePath); 
    if (target != null) {
      return target;
    }
    searchDate.subtract(1, 'days');
  }
  return null;
}

export function getNextDailyNote(app: App, file: TFile, dailyNoteFormat: string): TFile | null {
  const maxDaysToSearch = 365;
  let searchDate = moment(file.basename, dailyNoteFormat).add(1, 'days');
  const currentFilePath = file?.path || "";
  
  for (let i =0; i< maxDaysToSearch; i++) {
    const target = app.metadataCache.getFirstLinkpathDest(searchDate.format(dailyNoteFormat), currentFilePath); 
    if (target != null) {
      return target;
    }
    searchDate.add(1, 'days');
  }
  return null;
}

/**
 * Retrieve the previous note based on the `previous` property in the frontmatter.
 */
export function getPreviousNote(app: App, file: TFile, settings: MyPluginSettings): TFile | null {
  const previousLinkpath = getPreviousLinkpath(app, file);
  if (!previousLinkpath) {
    // handle daily note nav
    if (settings.enableDailyNoteNav && isDailyNote(file.basename, settings.dailyNoteFormat)) {
      return getPreviousDailyNote(app, file, settings.dailyNoteFormat);
    }
    // TODO feature for handling weekly note later
    return null;
  }

  const target = app.metadataCache.getFirstLinkpathDest(
    previousLinkpath,
    file.path
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
export function getNextNotes(app: App, file: TFile, settings: MyPluginSettings): TFile[] {
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
    if (previousLinkText === file.basename || previousLinkText === currentPath) {
      nextNotes.push(targetFile);
    }
  }

  // handle daily note implicit next notes
  if (settings.enableDailyNoteNav && isDailyNote(file.basename, settings.dailyNoteFormat)) {
    const nextDailyNote = getNextDailyNote(app, file, settings.dailyNoteFormat);
    if (nextDailyNote != null && !nextNotes.includes(nextDailyNote)) {
      nextNotes.push(nextDailyNote);
    }
  }

  return nextNotes;
}
