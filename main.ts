import { App, Editor, MarkdownView, Modal, Notice, Plugin,
  PluginSettingTab, Setting, FileSystemAdapter,
  Vault, TFile, normalizePath } from 'obsidian';


  interface MyPluginSettings {
    mySetting: string;
  }

  const DEFAULT_SETTINGS: MyPluginSettings = {
    mySetting: 'default'
  }
  export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;

    async onload() {
      await this.loadSettings();

      const getYYYYMMDD = () => {
        const rn = new Date();
        rn.setMinutes(rn.getMinutes() - rn.getTimezoneOffset());
        return rn.toISOString().split("T")[0];
      };

      const addTaskToFile = async (afile: string) => {
        const tasksApi = this.app.plugins.plugins['obsidian-tasks-plugin'].apiV1;
        let taskLine = await tasksApi.createTaskLineModal();
        console.log(`task added: ${taskLine}`);
        if (taskLine && taskLine!=="") {
          const tfilep = this.app.vault.getAbstractFileByPath(afile);
          if (!(tfilep instanceof TFile)) {
            throw new Error('BAD');
          }
          await this.app.vault.process(tfilep, (data) => {
            return (data + "\n" + taskLine);
          });
        }
      };

      const editTask = async (path: string, lineNumber: number) => {
        console.log("");
        console.log("vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv");
        console.log("editTask called");

        const originalFile = app.workspace.getActiveFile().path;
        console.log(`original file: ${originalFile}`);

        const neditor = app.workspace.activeEditor.editor;
        const tfilep = app.vault.getAbstractFileByPath(originalFile);
        console.log({ tfilep });
        const leaf = app.workspace.getLeaf(false);
        console.log({ leaf });
        leaf.openFile(tfilep);

        // const tasksApi = this.app.plugins.plugins['obsidian-tasks-plugin'].apiV1;
        // // const garbage = await tasksApi.editTaskLineModal(path, lineNumber);
        // const garbage = await tasksApi.createTaskLineModal(path, lineNumber);
        // await new Promise(resolve => setTimeout(resolve, 127));
        //
        //
        // console.log(`returning garbage`);
        // console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
        // console.log("");
        // return garbage;
      };

      const getDailyNote = () => {
        const tIso = getYYYYMMDD();
        const fnp = `Daily Notes/${tIso}.md`;
        console.log(`Checking for Daily Note: '${fnp}'`);
        const tfilep = this.app.vault.getAbstractFileByPath(fnp);
        if (!tfilep || (!(tfilep instanceof TFile))) {
          throw new Error('Daily note not created');
        }
        return fnp;
      };

      const goToNote = (path) => {
        const tfilep = app.vault.getAbstractFileByPath(path);
        const leaf = app.workspace.getLeaf(false);
        leaf.openFile(tfilep);
      };

      this.addCommand({
        id: 'create-inbox-task',
        name: 'Create inbox task',
        hotkeys: [{ modifiers: ["Mod"], key: "i" }],
        callback: async () => { addTaskToFile("_inbox.md") }
      });

      this.addCommand({
        id: 'create-daily-note-task',
        name: 'Create task in Daily Note',
        // hotkeys: [{ modifiers: ["Mod"], key: "a" }],
        callback: () => {
          const fn = getDailyNote();
          if (fn) {
            addTaskToFile(fn);
          }
        }
      });

      this.addCommand({
        id: "go-to-todos",
        name: "Go to TODOs",
        callback: () => {
          goToNote("TODOs.md");
        }
      });
      this.addCommand({
        id: "go-to-dashboard",
        name: "Go to Dashboard",
        callback: () => {
          goToNote("Dashboard.md");
        }
      });
      this.addCommand({
        id: "go-to-control",
        name: "Go to Control",
        callback: () => {
          goToNote("Control.md");
        }
      });
      this.addCommand({
        id: "go-to-atlas",
        name: "Go to Atlas",
        callback: () => {
          goToNote("Atlas.md");
        }
      });
      this.addCommand({
        id: "go-to-inbox",
        name: "Go to _inbox",
        callback: () => {
          goToNote("_inbox.md");
        }
      });


      // This adds a settings tab so the user can configure various aspects of the plugin
      this.addSettingTab(new SampleSettingTab(this.app, this));

      // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
      // Using this function will automatically remove the event listener when this plugin is disabled.
      this.registerDomEvent(document, 'click', async (evt: MouseEvent) => {
        // console.log('click', evt);
        // console.log("click", evt.srcElement);
        if (evt.srcElement.className.match(/tony-task-right/)) {
          console.log("YAY!");
          const path = evt.srcElement.attributes['data-path'].nodeValue;
          const line = Number(evt.srcElement.attributes['data-line'].nodeValue);
          console.log(`calling editTask with args '${path}' and '${line}'`);
          editTask(path, line);
        }
      });

      // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
      this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {

    }

    async loadSettings() {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
      await this.saveData(this.settings);
    }
  }

  class SampleModal extends Modal {
    constructor(app: App) {
      super(app);
    }

    onOpen() {
      const {contentEl} = this;
      contentEl.setText('Woah!');

      contentEl.createEl("input", { "text": "date picker", "type": "date" });

    }

    onClose() {
      const {contentEl} = this;
      contentEl.empty();
    }
  }

  class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
      super(app, plugin);
      this.plugin = plugin;
    }

    display(): void {
      const {containerEl} = this;

      containerEl.empty();

      new Setting(containerEl)
      .setName('Setting #1')
      .setDesc('Its a secret')
      .addText(text => text
               .setPlaceholder('Enter your secret')
               .setValue(this.plugin.settings.mySetting)
               .onChange(async (value) => {
                 this.plugin.settings.mySetting = value;
                 await this.plugin.saveSettings();
               }));
    }
}
