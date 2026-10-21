import React, { useRef, useState } from 'react';
import {
  Bold,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  PenLine,
  Quote,
} from 'lucide-react';
import RichText from '../RichText';
import { inputClass } from './Shared';

interface RichTextEditorProps {
  key?: React.Key;
  name: string;
  defaultValue?: string;
  maxLength: number;
  rows?: number;
}

const toolButton =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-gray-600 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300';

export default function RichTextEditor({
  name,
  defaultValue = '',
  maxLength,
  rows = 9,
}: RichTextEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  // Aplica a mudança e devolve o cursor/seleção ao lugar certo.
  const apply = (next: string, selStart: number, selEnd: number) => {
    setValue(next.slice(0, maxLength));
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const wrap = (before: string, after: string, placeholder: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    apply(next, start + before.length, start + before.length + selected.length);
  };

  const prefixLines = (prefix: (index: number) => string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEndRaw = value.indexOf('\n', end);
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
    const block = value.slice(lineStart, lineEnd) || 'Texto';
    const changed = block
      .split('\n')
      .map(
        (line, index) => prefix(index) + line.replace(/^(#{1,4}\s+|[-*]\s+|\d+[.)]\s+|>\s?)/, ''),
      )
      .join('\n');
    apply(
      value.slice(0, lineStart) + changed + value.slice(lineEnd),
      lineStart,
      lineStart + changed.length,
    );
  };

  const insertLink = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const label = value.slice(start, end) || 'texto do link';
    const insertion = `[${label}](https://)`;
    const urlStart = start + label.length + 3;
    apply(value.slice(0, start) + insertion + value.slice(end), urlStart, urlStart + 8);
  };

  const insertDivider = () => {
    const el = ref.current;
    if (!el) return;
    const at = el.selectionEnd;
    const insertion = `${at && !value.slice(0, at).endsWith('\n') ? '\n' : ''}\n---\n\n`;
    apply(
      value.slice(0, at) + insertion + value.slice(at),
      at + insertion.length,
      at + insertion.length,
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Formatação do texto">
          <button
            type="button"
            title="Negrito"
            aria-label="Negrito"
            className={toolButton}
            onClick={() => wrap('**', '**', 'texto em negrito')}
            disabled={tab === 'preview'}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Itálico"
            aria-label="Itálico"
            className={toolButton}
            onClick={() => wrap('*', '*', 'texto em itálico')}
            disabled={tab === 'preview'}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Título de seção"
            aria-label="Título de seção"
            className={toolButton}
            onClick={() => prefixLines(() => '## ')}
            disabled={tab === 'preview'}
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Lista"
            aria-label="Lista com marcadores"
            className={toolButton}
            onClick={() => prefixLines(() => '- ')}
            disabled={tab === 'preview'}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Lista numerada"
            aria-label="Lista numerada"
            className={toolButton}
            onClick={() => prefixLines((index) => `${index + 1}. `)}
            disabled={tab === 'preview'}
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Citação"
            aria-label="Citação"
            className={toolButton}
            onClick={() => prefixLines(() => '> ')}
            disabled={tab === 'preview'}
          >
            <Quote className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Link"
            aria-label="Inserir link"
            className={toolButton}
            onClick={insertLink}
            disabled={tab === 'preview'}
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Linha divisória"
            aria-label="Linha divisória"
            className={toolButton}
            onClick={insertDivider}
            disabled={tab === 'preview'}
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
        <div
          className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'write'}
            onClick={() => setTab('write')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === 'write' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
          >
            <PenLine className="h-3.5 w-3.5" /> Escrever
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            onClick={() => setTab('preview')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === 'preview' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
          >
            <Eye className="h-3.5 w-3.5" /> Pré-visualizar
          </button>
        </div>
      </div>

      {/* O campo continua no formulário mesmo na pré-visualização */}
      <textarea
        ref={ref}
        name={name}
        required
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={`${inputClass} font-mono text-[13px] leading-6 ${tab === 'preview' ? 'hidden' : ''}`}
        placeholder={
          'Escreva o comunicado.\n\n## Título de seção\nTexto com **negrito** e *itálico*.\n\n- item da lista'
        }
      />
      {tab === 'preview' && (
        <div className="min-h-[10rem] rounded-lg border border-gray-200 bg-white p-4 text-[15px] text-gray-700">
          {value.trim() ? (
            <RichText text={value} />
          ) : (
            <p className="text-sm text-gray-400">Nada para mostrar ainda.</p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
        <span>
          <code>## título</code> · <code>**negrito**</code> · <code>*itálico*</code> ·{' '}
          <code>- lista</code> · <code>1. lista</code> · <code>&gt; citação</code> ·{' '}
          <code>[texto](https://…)</code> · <code>---</code>
        </span>
        <span>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
