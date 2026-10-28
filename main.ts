import {
  App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder,
  moment, normalizePath,
} from 'obsidian';
import {
  DueChoice, appendBlock, buildTaskLine, dueFor, normalizeTags, renderTemplate,
} from './lib';


/***************************************************************
 * settings
 */

interface MirandaSettings {
  tagChips:     string[];                    // tags offered as chips in the add-task modal
  defaultDue:   'today' | 'none';            // for the daily note; the inbox starts with none
  showPriority: boolean;
}

const DEFAULT_SETTINGS: MirandaSettings = {
  tagChips:     ['life', 'music', 'nypl', 'doh', 'aa', 'afth'],
  defaultDue:   'today',
  showPriority: false,
};

type Target = 'daily' | 'inbox';

const INBOX_PATH           = '_inbox.md';
const DEFAULT_DAILY_FORMAT = 'YYYY-MM-DD';

interface DailySettings { folder: string; format: string; template: string; }


/***************************************************************
 * the add-task modal
 */

class AddTaskModal extends Modal {
  private textEl!:  HTMLInputElement;
  private otherEl!: HTMLInputElement;
  private dateEl!:  HTMLInputElement;
  private tagChips      = new Map<string, HTMLButtonElement>();
  private dueChips      = new Map<DueChoice, HTMLButtonElement>();
  private priorityChips = new Map<string, HTMLButtonElement>();
  private selectedTags  = new Set<string>();
  private due:      DueChoice;
  private priority: string | null = null;
  private busy = false;

  constructor(app: App, private plugin: Miranda, private target: Target) {
    super(app);
    this.due = target === 'daily' ? plugin.settings.defaultDue : 'none';
  }

  onOpen(): void {
    const { contentEl } = this;
    this.modalEl.addClass('miranda-add-task');
    contentEl.empty();

    this.titleEl.setText(this.target === 'daily' ? 'Add task to Daily Note' : 'Add task to Inbox');

    // the task
    this.textEl = contentEl.createEl('input', {
      type: 'text', cls: 'miranda-text',
      attr: { placeholder: 'What needs doing?', autocapitalize: 'sentences', enterkeyhint: 'done', spellcheck: 'true' },
    });
    this.textEl.addEventListener('keydown', (ev) => this.onEnter(ev));

    // the Add button sits right under the text so the keyboard can't hide it
    const add = contentEl.createEl('button', { text: 'Add', cls: 'mod-cta miranda-add', attr: { type: 'button' } });
    add.addEventListener('click', () => { void this.submit(); });

    // tags
    const tagRow = this.row(contentEl, 'Tags');
    for (const tag of this.plugin.settings.tagChips) {
      this.tagChips.set(tag, this.chip(tagRow, `#${tag}`, () => {
        if (this.selectedTags.has(tag)) this.selectedTags.delete(tag);
        else                            this.selectedTags.add(tag);
        this.refresh();
      }));
    }
    this.otherEl = tagRow.createEl('input', {
      type: 'text', cls: 'miranda-other',
      attr: { placeholder: 'other…', autocapitalize: 'none', autocomplete: 'off', enterkeyhint: 'done' },
    });
    this.otherEl.addEventListener('keydown', (ev) => this.onEnter(ev));

    // due date
    const dueRow = this.row(contentEl, 'Due');
    const choices: Array<[DueChoice, string]> = [
      ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['nextweek', 'Next week'], ['none', 'No date'],
    ];
    for (const [choice, label] of choices) {
      this.dueChips.set(choice, this.chip(dueRow, label, () => {
        this.due = choice;
        this.dateEl.value = '';
        this.refresh();
      }));
    }
    this.dateEl = dueRow.createEl('input', { type: 'date', cls: 'miranda-date' });
    this.dateEl.addEventListener('change', () => {
      if (this.dateEl.value) { this.due = 'custom'; this.refresh(); }
    });

    // priority (off unless enabled in the settings)
    if (this.plugin.settings.showPriority) {
      const prioRow = this.row(contentEl, 'Priority');
      for (const level of ['high', 'medium', 'low']) {
        this.priorityChips.set(level, this.chip(prioRow, level, () => {
          this.priority = this.priority === level ? null : level;
          this.refresh();
        }));
      }
    }

    this.refresh();
    this.textEl.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private onEnter(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.isComposing) {
      ev.preventDefault();
      void this.submit();
    }
  }

  private row(parent: HTMLElement, label: string): HTMLElement {
    const row = parent.createDiv({ cls: 'miranda-row' });
    row.createSpan({ cls: 'miranda-label', text: label });
    return row;
  }

  private chip(parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
    const el = parent.createEl('button', { text: label, cls: 'miranda-chip', attr: { type: 'button' } });
    el.addEventListener('click', (ev) => { ev.preventDefault(); onClick(); });
    return el;
  }

  private refresh(): void {
    this.tagChips.forEach((el, tag)         => el.toggleClass('is-selected', this.selectedTags.has(tag)));
    this.dueChips.forEach((el, choice)      => el.toggleClass('is-selected', this.due === choice));
    this.priorityChips.forEach((el, level)  => el.toggleClass('is-selected', this.priority === level));
    this.dateEl.toggleClass('is-selected', this.due === 'custom');
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    const text = this.textEl.value.trim();
    if (!text) {
      new Notice('Type the task first');
      this.textEl.focus();
      return;
    }

    const line = buildTaskLine({
      text,
      tags:     normalizeTags(Array.from(this.selectedTags).concat(this.otherEl.value)),
      priority: this.priority,
      due:      dueFor(this.due, this.dateEl.value, new Date()),
    });

    this.busy = true;
    try {
      const path = await this.plugin.addTaskLine(this.target, line);
      new Notice(`Added to ${path}\n${line}`);
      this.close();
    } catch (error) {
      new Notice(`Miranda: couldn't add the task (${(error as Error).message})`);
      this.busy = false;
    }
  }
}


/***************************************************************
 * the plugin
 */

export default class Miranda extends Plugin {
  settings!: MirandaSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: 'create-daily-note-task',
      name: 'Create task in Daily Note',
      callback: () => new AddTaskModal(this.app, this, 'daily').open(),
    });

    this.addCommand({
      id: 'create-inbox-task',
      name: 'Create inbox task',
      hotkeys: [{ modifiers: ['Mod'], key: 'i' }],
      callback: () => new AddTaskModal(this.app, this, 'inbox').open(),
    });

    const goTo = (id: string, name: string, path: string) =>
      this.addCommand({ id, name, callback: () => this.goToNote(path) });
    goTo('go-to-todos',     'Go to TODOs',     'TODOs.md');
    goTo('go-to-dashboard', 'Go to Dashboard', 'Dashboard.md');
    goTo('go-to-control',   'Go to Control',   'Control.md');
    goTo('go-to-atlas',     'Go to Atlas',     'Atlas.md');
    goTo('go-to-inbox',     'Go to _inbox',    INBOX_PATH);

    this.addSettingTab(new MirandaSettingTab(this.app, this));
  }

  // ---- notes ----------------------------------------------------------

  // Append a task line to the daily note or the inbox; resolves to the path
  async addTaskLine(target: Target, line: string): Promise<string> {
    const file = target === 'daily'
      ? await this.ensureDailyNote()
      : await this.ensureNote(INBOX_PATH, '');
    await this.app.vault.process(file, (data) => appendBlock(data, line));
    return file.path;
  }

  goToNote(path: string): void {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
    else new Notice(`${path} doesn't exist`);
  }

  // The core Daily Notes plugin's folder / date format / template
  private dailySettings(): DailySettings {
    const options = (this.app as any).internalPlugins?.plugins?.['daily-notes']?.instance?.options ?? {};
    const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/^\/+|\/+$/g, '') : '');
    return {
      folder:   clean(options.folder),
      format:   clean(options.format) || DEFAULT_DAILY_FORMAT,
      template: clean(options.template),
    };
  }

  private async ensureDailyNote(): Promise<TFile> {
    const { folder, format, template } = this.dailySettings();
    const now  = new Date();
    const name = `${moment(now).format(format)}.md`;
    const path = normalizePath(folder ? `${folder}/${name}` : name);

    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;

    const title   = name.replace(/\.md$/, '').split('/').pop() || '';
    const initial = await this.renderDailyTemplate(template, title, now, format);
    return this.ensureNote(path, initial);
  }

  private async renderDailyTemplate(template: string, title: string, now: Date, dateFormat: string): Promise<string> {
    if (!template) return '';
    const path = normalizePath(template.endsWith('.md') ? template : `${template}.md`);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return '';
    const text = await this.app.vault.read(file);
    return renderTemplate(text, title,
      (fmt, offsetDays) => moment(now).add(offsetDays, 'days').format(fmt), dateFormat);
  }

  private async ensureNote(path: string, initial: string): Promise<TFile> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    if (existing) throw new Error(`${path} is a folder`);
    await this.ensureFolder(path.slice(0, path.lastIndexOf('/')));
    return this.app.vault.create(path, initial);
  }

  private async ensureFolder(folder: string): Promise<void> {
    if (!folder) return;
    const parts = folder.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const partial = parts.slice(0, i).join('/');
      const existing = this.app.vault.getAbstractFileByPath(partial);
      if (existing instanceof TFolder) continue;
      if (existing) throw new Error(`${partial} is a file, not a folder`);
      await this.app.vault.createFolder(partial);
    }
  }

  // ---- settings -------------------------------------------------------

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}


/***************************************************************
 * settings tab
 */

class MirandaSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: Miranda) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).
      setName('Tag chips').
      setDesc('Tags offered in the add-task modal, separated by commas or spaces.').
      addTextArea((area) => area.
        setValue(this.plugin.settings.tagChips.join(', ')).
        onChange(async (value) => {
          this.plugin.settings.tagChips = normalizeTags([value]).map((t) => t.slice(1));
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl).
      setName('Default due date').
      setDesc('For tasks added to the daily note. Inbox tasks start with no date.').
      addDropdown((drop) => drop.
        addOption('today', 'Today').
        addOption('none', 'No date').
        setValue(this.plugin.settings.defaultDue).
        onChange(async (value) => {
          this.plugin.settings.defaultDue = value === 'none' ? 'none' : 'today';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl).
      setName('Show priority row').
      setDesc('Adds high / medium / low chips to the modal.').
      addToggle((toggle) => toggle.
        setValue(this.plugin.settings.showPriority).
        onChange(async (value) => {
          this.plugin.settings.showPriority = value;
          await this.plugin.saveSettings();
        }));
  }
}
