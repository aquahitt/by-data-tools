import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/textfield/outlined-text-field.js';
import './ui/theme.css';

import type { FormatId } from './core/types';
import { PERSONAL_NUMBER_FORMATS } from './formats';
import { persistFormat, readStoredFormat, resolveInitialFormat } from './ui/formatState';
import { mountFormatSwitch } from './ui/formatSwitch';
import { mountGeneratePanel } from './ui/generatePanel';
import { mountValidatePanel } from './ui/validatePanel';

const byId = (id: string) => document.getElementById(id) as HTMLElement;

const notice = byId('format-notice');
const validatePanel = mountValidatePanel(byId('validate'), {
  formats: PERSONAL_NUMBER_FORMATS,
  inputLabel: 'Идентификационный номер',
  onSwitchFormat: (id) => setFormat(id),
});
const generatePanel = mountGeneratePanel(byId('generate'), (value) => validatePanel.check(value));
const initial = resolveInitialFormat(location.search, readStoredFormat());
const formatSwitch = mountFormatSwitch(byId('format-switch'), PERSONAL_NUMBER_FORMATS, initial, (id) => setFormat(id));

function setFormat(id: FormatId): void {
  const format = PERSONAL_NUMBER_FORMATS.find((f) => f.id === id)!;
  persistFormat(id);
  formatSwitch.set(id);
  notice.textContent = format.notice ?? '';
  notice.hidden = !format.notice;
  validatePanel.setFormat(format);
  generatePanel.setFormat(format);
}

setFormat(initial);
