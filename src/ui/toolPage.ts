import type { FormatId, FormatModule } from '../core/types';
import type { Tool } from '../tools';
import { el } from './dom';
import { mountBulkPanel } from './bulkPanel';
import { mountFormatSwitch } from './formatSwitch';
import { mountGeneratePanel } from './generatePanel';
import { mountValidatePanel } from './validatePanel';

export interface ToolPage {
  setFormat(format: FormatModule): void;
}

function card(id: string, title: string, body: HTMLElement): HTMLElement {
  return el('section', { class: 'card', 'aria-labelledby': id }, el('h2', { id }, title), body);
}

/** One section: format switch (when there are several), notice, validate and generate cards. */
export function mountToolPage(
  root: HTMLElement,
  tool: Tool,
  initial: FormatModule,
  onFormatChange: (id: FormatId) => void,
): ToolPage {
  const switchBox = el('div');
  const header = el('div', { class: 'tool-header' }, switchBox);
  const notice = el('p', { class: 'notice' });
  const validateBody = el('div');
  const generateBody = el('div');
  const bulkBody = el('div');
  root.append(
    header,
    notice,
    card(`${tool.id}-validate`, 'Проверка и разбор', validateBody),
    card(`${tool.id}-generate`, 'Генерация', generateBody),
    card(`${tool.id}-bulk`, 'Проверка списком', bulkBody),
  );

  const formatSwitch = tool.formats.length > 1 ? mountFormatSwitch(switchBox, tool.formats, initial.id, onFormatChange) : null;
  header.hidden = !formatSwitch;
  const validatePanel = mountValidatePanel(validateBody, {
    formats: tool.formats,
    inputLabel: tool.inputLabel,
    inputHint: tool.texts?.inputHint,
    status: tool.texts?.status,
    onSwitchFormat: onFormatChange,
  });
  const bulkPanel = mountBulkPanel(bulkBody);
  const generatePanel = mountGeneratePanel(generateBody, (value) => validatePanel.check(value), tool.texts?.generateHelp);

  function setFormat(format: FormatModule): void {
    formatSwitch?.set(format.id);
    notice.textContent = format.notice ?? '';
    notice.hidden = !format.notice;
    validatePanel.setFormat(format);
    generatePanel.setFormat(format);
    bulkPanel.setFormat(format);
  }

  setFormat(initial);
  return { setFormat };
}
