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

import { DEFAULT_TOOL_ID, findTool, TOOLS, toolsByCategory } from './tools';
import { persistFormat, readStoredFormats, resolveFormatId } from './ui/formatState';
import { mdIcon } from './ui/icons';
import { resolveRoute } from './ui/router';
import { mountSidebar } from './ui/sidebar';
import { mountToolPage, type ToolPage } from './ui/toolPage';

const byId = (id: string) => document.getElementById(id) as HTMLElement;

const title = byId('tool-title');
const container = byId('tool');
const menuButton = byId('menu-button');
menuButton.append(mdIcon('menu'));
const sidebar = mountSidebar(byId('sidebar'), menuButton, byId('scrim'), byId('content'), toolsByCategory());

let current: { toolId: string; page: ToolPage } | null = null;

function show(): void {
  const route = resolveRoute(location.hash, location.search, TOOLS, DEFAULT_TOOL_ID);
  const tool = findTool(route.toolId)!;
  const { stored, legacy } = readStoredFormats(tool.id);
  const formatId = resolveFormatId(tool.id, tool.formats, route.format, stored, legacy);
  persistFormat(tool.id, formatId);
  const format = tool.formats.find((f) => f.id === formatId)!;

  if (current?.toolId === tool.id) {
    current.page.setFormat(format);
    return;
  }

  const firstRender = current === null;
  container.replaceChildren();
  const page = mountToolPage(container, tool, format, (id) => {
    persistFormat(tool.id, id);
    page.setFormat(tool.formats.find((f) => f.id === id)!);
  });
  current = { toolId: tool.id, page };
  title.textContent = tool.title;
  document.title = `${tool.title} — by-data-tools`;
  sidebar.setActive(tool.id);
  if (!firstRender) title.focus();
}

window.addEventListener('hashchange', show);
show();
