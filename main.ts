import { Plugin, TFile } from "obsidian";
import { NextNoteSuggestModal } from "./lib/NextNoteSuggestModal";
import { getActiveFile, getPreviousNote, getNextNotes } from "./lib/obsidian";
import {DEFAULT_SETTINGS, MyPluginSettings, MySettingTab} from "./lib/settings";

export default class PreviousRiverPlugin extends Plugin {
	settings: MyPluginSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "go-to-previous-note",
      name: "Go to previous note",
      callback: () => this.goToPreviousNote(),
    });

    this.addCommand({
      id: "go-to-next-note",
      name: "Go to next note",
      callback: () => this.goToNextNote(),
    });

    this.addCommand({
      id: "go-to-first-note",
      name: "Go to first note",
      callback: () => this.goToFirstNote(),
    });

    this.addCommand({
      id: "go-to-last-note",
      name: "Go to last note",
      callback: () => this.goToLastNote(),
    });

    this.addSettingTab(new MySettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
  }

  async saveSettings() {
      await this.saveData(this.settings);
  }

  async goToPreviousNote() {
    const file = getActiveFile(this.app);
    if (!file) {
      return;
    }

    const target = getPreviousNote(this.app, file, this.settings);
    if (!target) {
      return;
    }

    await this.app.workspace.getLeaf().openFile(target);
  }

  async goToNextNote() {
    const file = getActiveFile(this.app);
    if (!file) {
      return;
    }
  
    const nextNotes = getNextNotes(this.app, file, this.settings);
  
    if (nextNotes.length === 0) {
      return;
    }
  
    if (nextNotes.length === 1) {
      // If only one candidate exists, open it directly.
      await this.app.workspace.getLeaf().openFile(nextNotes[0]);
    } else {
      // If multiple candidates exist, open a suggestion modal.
      new NextNoteSuggestModal(this.app, nextNotes, (selectedFile) => {
        void this.app.workspace.getLeaf().openFile(selectedFile);
      }).open();
    }
  }

  async goToFirstNote() {
    const file = getActiveFile(this.app);
    if (!file) {
      return;
    }

    const startNote = file;
    let firstNote = file;
    while (true) {
      const previousNote = getPreviousNote(this.app, firstNote, this.settings);
      if (!previousNote || previousNote === startNote) {
        break;
      }
      firstNote = previousNote;
    }

    if (firstNote !== file) {
      await this.app.workspace.getLeaf().openFile(firstNote);
    }
  }

  async goToLastNote() {
    const file = getActiveFile(this.app);
    if (!file) {
      return;
    }

    const startNote = file;
    let lastNote = file;
    while (true) {
      const nextNotes = getNextNotes(this.app, lastNote, this.settings);
      if (nextNotes.length === 0 || nextNotes.includes(startNote)) {
        break;
      }

      if (nextNotes.length === 1) {
        // If only one next note exists, follow it.
        lastNote = nextNotes[0];
      } else {
        // If multiple candidates exist, open a suggestion modal.
        const selectedNote = await new Promise<TFile | null>((resolve) => {
          new NextNoteSuggestModal(this.app, nextNotes, resolve).open();
        });

        if (!selectedNote) {
          // If the user cancels selection, stop.
          return;
        }

        lastNote = selectedNote;
      }
    }

    if (lastNote !== file) {
      await this.app.workspace.getLeaf().openFile(lastNote);
    }
  }
}
