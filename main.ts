import { App, Editor, MarkdownView, Modal, Notice, Plugin,
  PluginSettingTab, Setting, FileSystemAdapter,
  Vault, TFile, normalizePath } from 'obsidian';


  // Remember to rename these classes and interfaces!




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

      const editTask2 = async (checking: boolean, editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
        console.log("vvvvvvvvvvvvvvvvvvvvvvvvvvvvv");
        console.log(`editor line count ${editor.lineCount()}`);
        const originalFile = app.workspace.getActiveFile().path;
        const originalScrollInfo = editor.getScrollInfo();
        const originalCursor = editor.getCursor();
        const originalLine = originalCursor.line;
        console.log(`original file: ${originalFile}`);
        console.log(`original scroll info: ${JSON.stringify(originalScrollInfo)}`);
        console.log(`original line: ${JSON.stringify(originalLine)}`);
        const tasksApi = this.app.plugins.plugins['obsidian-tasks-plugin'].apiV1;
        const garbage = await tasksApi.editTaskLineModal2("Daily Notes/2024-02-27.md",
                                                          10,
                                                          checking,
                                                          editor,
                                                          view);
        await new Promise(resolve => setTimeout(resolve, 127));
        const neditor = app.workspace.activeEditor.editor;
        console.log(`editor line count 222: ${neditor.lineCount()}`);
        console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
        const tfilep = app.vault.getAbstractFileByPath(originalFile);
        const leaf = app.workspace.getLeaf(false);
        leaf.openFile(tfilep);
        // await new Promise(resolve => setTimeout(resolve, 127));
        // const nneditor = app.workspace.activeEditor.editor;
        // nneditor.setCursor(originalLine-1, 0);
        console.log(`returning garbage`);
        return garbage;

        // if (taskLine && taskLine!=="") {
        //   await this.app.vault.process(tfilep, (data) => {
        //     return (data + "\n" + taskLine);
        //   });
        // }
      };

      const editTask = async (path: string, lineNumber: number) => {
        console.log("");
        console.log("vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv");
        console.log("editTask called");

        const originalFile = app.workspace.getActiveFile().path;
        console.log(`original file: ${originalFile}`);

        const tasksApi = this.app.plugins.plugins['obsidian-tasks-plugin'].apiV1;
        const garbage = await tasksApi.editTaskLineModal(path, lineNumber);
        await new Promise(resolve => setTimeout(resolve, 127));

        const neditor = app.workspace.activeEditor.editor;
        const tfilep = app.vault.getAbstractFileByPath(originalFile);
        const leaf = app.workspace.getLeaf(false);
        leaf.openFile(tfilep);

        console.log(`returning garbage`);
        console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
        console.log("");
        return garbage;
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

      this.addCommand({
        id: 'create-inbox-task',
        name: 'Create inbox task',
        hotkeys: [{ modifiers: ["Mod"], key: "i" }],
        callback: async () => { addTaskToFile("_inbox.md") }
      });

      this.addCommand({
        id: 'pee-pee',
        name: "Pee-pee",
        callback: () => {
          editTask("Daily Notes/2024-02-27.md", 9);
        }
      });

      this.addCommand({
        id: 'edit-task',
        name: "Edit Task",
        // callback: editTask
        // editorCheckCallback: editTask
        editorCheckCallback: editTask2
      });

      this.addCommand({
        id: "go-to-mobile",
        name: "Go to Mobile",
        callback: async () => {
          const tfilep = app.vault.getAbstractFileByPath("Mobile.md");
          const leaf = app.workspace.getLeaf(false);
          leaf.openFile(tfilep);
        }
      });

      this.addCommand({
        id: 'create-daily-note-task',
        name: 'Create task in Daily Note',
        hotkeys: [{ modifiers: ["Mod"], key: "a" }],
        callback: () => {
          const fn = getDailyNote();
          if (fn) {
            addTaskToFile(fn);
          }
        }
      });

      // This adds a settings tab so the user can configure various aspects of the plugin
      this.addSettingTab(new SampleSettingTab(this.app, this));

      // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
      // Using this function will automatically remove the event listener when this plugin is disabled.
      this.registerDomEvent(document, 'click', async (evt: MouseEvent) => {
        // console.log('click', evt);
        // console.log("click", evt.srcElement);
        // console.log("click", evt.srcElement.className);
        // console.log("click", evt.srcElement.attributes['data-path'].nodeValue);
        // console.log("click", evt.srcElement.attributes['data-line'].nodeValue);
        if (evt.srcElement.className.match(/tony-task-due/)) {
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
