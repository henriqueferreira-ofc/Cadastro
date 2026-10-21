import React from 'react';

// Formatação simples para os comunicados (sem HTML): # títulos, **negrito**, *itálico*, listas,
// > citação, [texto](https://link) e --- divisor. Tudo vira elementos React, nunca HTML bruto.

type Inline = string | React.ReactElement;

const inlinePattern =
  /(\[([^\]\n]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\))|(\*\*([^*\n]+?)\*\*)|(__([^_\n]+?)__)|(\*([^*\s][^*\n]*?)\*)|(`([^`\n]+)`)|(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g;

function renderInline(text: string, keyPrefix: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const key = `${keyPrefix}-${index++}`;
    if (match[1]) {
      parts.push(
        <a
          key={key}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
        >
          {match[2]}
        </a>,
      );
    } else if (match[4] || match[6]) {
      parts.push(
        <strong key={key} className="font-bold text-slate-900">
          {renderInline(match[5] ?? match[7], key)}
        </strong>,
      );
    } else if (match[8]) {
      parts.push(<em key={key}>{renderInline(match[9], key)}</em>);
    } else if (match[10]) {
      parts.push(
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-slate-800">
          {match[11]}
        </code>,
      );
    } else if (match[12]) {
      parts.push(
        <a
          key={key}
          href={match[12]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
        >
          {match[12]}
        </a>,
      );
    }
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const headingStyles = [
  'mt-7 mb-2 text-xl font-bold tracking-tight text-slate-900',
  'mt-6 mb-2 text-lg font-bold tracking-tight text-slate-900',
  'mt-5 mb-1.5 text-base font-bold text-slate-900',
  'mt-4 mb-1 text-sm font-bold uppercase tracking-wide text-slate-500',
];

export default function RichText({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: React.ReactElement[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const id = `p${key++}`;
    blocks.push(
      <p key={id} className="my-3 leading-7">
        {paragraph.map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {renderInline(line, `${id}-${i}`)}
          </React.Fragment>
        ))}
      </p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const id = `l${key++}`;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={id}
        className={`my-3 space-y-1.5 pl-6 leading-7 ${list.ordered ? 'list-decimal' : 'list-disc'} marker:text-blue-700`}
      >
        {list.items.map((item, i) => (
          <li key={i}>{renderInline(item, `${id}-${i}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const id = `q${key++}`;
    blocks.push(
      <blockquote
        key={id}
        className="my-4 rounded-r-xl border-l-4 border-blue-300 bg-blue-50/60 px-4 py-2 italic text-slate-700"
      >
        {quote.map((line, i) => (
          <p key={i} className="my-1 leading-7">
            {renderInline(line, `${id}-${i}`)}
          </p>
        ))}
      </blockquote>,
    );
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    const bullet = /^\s*[-*•]\s+(.+)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    const quoted = /^>\s?(.*)$/.exec(line);

    if (!line.trim()) {
      flushAll();
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushAll();
      blocks.push(<hr key={`h${key++}`} className="my-6 border-slate-200" />);
    } else if (heading) {
      flushAll();
      const id = `t${key++}`;
      const level = heading[1].length;
      blocks.push(
        React.createElement(
          level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5',
          { key: id, className: headingStyles[level - 1] },
          renderInline(heading[2], id),
        ),
      );
    } else if (bullet || numbered) {
      flushParagraph();
      flushQuote();
      const ordered = !!numbered && !bullet;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((bullet || numbered)![1]);
    } else if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
    } else {
      flushList();
      flushQuote();
      paragraph.push(line);
    }
  }
  flushAll();

  return <div className={`rich-text break-words ${className}`}>{blocks}</div>;
}

// Versão sem formatação, para prévias curtas (cartões da linha do tempo).
export function stripMarkdown(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\[([^\]\n]+)\]\((?:https?:\/\/|mailto:)[^\s)]+\)/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(?<![*\w])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
