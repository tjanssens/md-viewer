// Loaded on demand (separate chunk) the first time edit mode is opened.
import { EditorState } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection
} from '@codemirror/view';
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands';
import { Language, defineLanguageFacet, syntaxHighlighting } from '@codemirror/language';
import { parser as markdownParser, GFM } from '@lezer/markdown';
import { classHighlighter } from '@lezer/highlight';

// Plain Markdown language without the embedded HTML/JS/CSS grammars (keeps the chunk small).
const markdownLanguage = new Language(defineLanguageFacet(), markdownParser.configure([GFM]), [], 'markdown');

export interface Editor {
  getText(): string;
  setText(text: string): void;
  focus(): void;
  topLine(): number;
}

export function createEditor(
  parent: HTMLElement,
  text: string,
  onChange: (text: string) => void,
  onScroll: (line: number) => void
): Editor {
  const status = document.createElement('div');
  status.className = 'editor-status';
  let silent = false;

  const updateStatus = (state: EditorState) => {
    const line = state.doc.lineAt(state.selection.main.head).number;
    status.textContent = `Line ${line} of ${state.doc.lines}`;
  };

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        markdownLanguage,
        syntaxHighlighting(classHighlighter),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.updateListener.of(u => {
          if (u.docChanged && !silent) onChange(u.state.doc.toString());
          if (u.docChanged || u.selectionSet) updateStatus(u.state);
        })
      ]
    })
  });
  parent.append(status);
  updateStatus(view.state);

  const topLine = () => {
    const top = view.scrollDOM.scrollTop;
    const block = view.lineBlockAtHeight(top);
    const line = view.state.doc.lineAt(block.from).number;
    return line + Math.min(1, Math.max(0, (top - block.top) / Math.max(1, block.height)));
  };
  view.scrollDOM.addEventListener('scroll', () => onScroll(topLine()), { passive: true });

  return {
    getText: () => view.state.doc.toString(),
    setText(next: string) {
      const head = Math.min(view.state.selection.main.head, next.length);
      silent = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next }, selection: { anchor: head } });
      silent = false;
    },
    focus: () => view.focus(),
    topLine
  };
}
