import React, { useEffect, useState } from 'react';
import { Bell, ChevronDown, ChevronUp, Download, Edit3, Paperclip, Plus } from 'lucide-react';
import {
  downloadPostAttachment,
  fileBase64,
  managementApi,
} from '../../management_service';
import { Dialog, Field, Notice, inputClass, primaryClass, secondaryClass } from './Shared';
import RichTextEditor from './RichTextEditor';

type PostCategory = 'INSTITUCIONAL' | 'TRABALHO' | 'SECRETARIA' | 'FINANCEIRO';
type PostStatus = 'RASCUNHO' | 'PUBLICADO' | 'ARQUIVADO';

type AdminPost = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: PostCategory;
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Array<{
    id: number;
    title: string;
    fileName: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }>;
};

const categoryLabels: Record<PostCategory, string> = {
  INSTITUCIONAL: 'Institucional',
  TRABALHO: 'Trabalhos da AAFAB',
  SECRETARIA: 'Secretaria',
  FINANCEIRO: 'Financeiro',
};

const statusLabels: Record<PostStatus, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADO: 'Publicado',
  ARQUIVADO: 'Arquivado',
};

export default function CommunicationsManager({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<AdminPost | 'NEW' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setPosts(await managementApi<AdminPost[]>('/comunicados'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os comunicados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && posts.length === 0) void load();
  }, [expanded]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await managementApi<AdminPost>(
        editing === 'NEW' ? '/comunicados' : `/comunicados/${editing.id}`,
        {
        title: form.get('title'),
        summary: form.get('summary'),
        content: form.get('content'),
        category: form.get('category'),
        status: form.get('status'),
        },
      );
      const file = form.get('attachment') as File;
      if (file?.size) {
        if (file.size > 5 * 1024 * 1024) throw new Error('O anexo deve ter até 5 MB.');
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
          throw new Error('O anexo deve ser PDF, JPG ou PNG.');
        }
        await managementApi(`/comunicados/${saved.id}/anexos`, {
          title: String(form.get('attachmentTitle') || file.name),
          fileName: file.name,
          mimeType: file.type,
          content: await fileBase64(file),
        });
      }
      setEditing(null);
      setMessage(
        form.get('status') === 'PUBLICADO'
          ? 'Comunicado publicado no Portal do Associado.'
          : 'Comunicado salvo.',
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar o comunicado.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(post: AdminPost, status: PostStatus) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await managementApi(`/comunicados/${post.id}`, {
        title: post.title,
        summary: post.summary,
        content: post.content,
        category: post.category,
        status,
      });
      setMessage(status === 'PUBLICADO' ? 'Comunicado publicado.' : 'Comunicado arquivado.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível alterar o comunicado.');
    } finally {
      setBusy(false);
    }
  }

  const current = editing === 'NEW' ? null : editing;

  return (
    <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Bell className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold text-gray-900">Comunicados do Portal do Associado</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Publique os trabalhos, avisos e informações que os associados poderão ver.
            </span>
          </span>
          {expanded ? <ChevronUp className="ml-auto h-5 w-5 text-gray-400" /> : <ChevronDown className="ml-auto h-5 w-5 text-gray-400" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setEditing('NEW');
          }}
          className={primaryClass}
        >
          <Plus className="mr-1 inline h-4 w-4" /> Novo comunicado
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 bg-gray-50 p-4 sm:p-5">
          <Notice error={error} message={message} />
          {loading ? (
            <p className="text-sm text-gray-500">Carregando comunicados…</p>
          ) : posts.length ? (
            <div className="space-y-2">
              {posts.map((post) => (
                <article key={post.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                          {categoryLabels[post.category]}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          post.status === 'PUBLICADO'
                            ? 'bg-green-50 text-green-700'
                            : post.status === 'ARQUIVADO'
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-amber-50 text-amber-800'
                        }`}>
                          {statusLabels[post.status]}
                        </span>
                      </div>
                      <h3 className="mt-2 font-bold text-gray-900">{post.title}</h3>
                      <p className="mt-1 text-sm text-gray-600">{post.summary}</p>
                      {!!post.attachments?.length && (
                        <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-700">
                          <Paperclip className="h-3.5 w-3.5" /> {post.attachments.length}{' '}
                          {post.attachments.length === 1 ? 'anexo' : 'anexos'}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button type="button" onClick={() => setEditing(post)} className={secondaryClass}>
                        <Edit3 className="mr-1 inline h-4 w-4" /> Editar
                      </button>
                      {post.status !== 'PUBLICADO' && (
                        <button type="button" disabled={busy} onClick={() => changeStatus(post, 'PUBLICADO')} className={primaryClass}>
                          Publicar
                        </button>
                      )}
                      {post.status === 'PUBLICADO' && (
                        <button type="button" disabled={busy} onClick={() => changeStatus(post, 'ARQUIVADO')} className={secondaryClass}>
                          Arquivar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              Nenhum comunicado criado. Use “Novo comunicado” para publicar a primeira informação.
            </p>
          )}
        </div>
      )}

      {editing && (
        <Dialog
          title={editing === 'NEW' ? 'Novo comunicado' : 'Editar comunicado'}
          onClose={() => setEditing(null)}
          busy={busy}
        >
          <form onSubmit={save} className="space-y-4">
            <Field label="Título">
              <input name="title" required maxLength={160} defaultValue={current?.title || ''} className={inputClass} />
            </Field>
            <Field label="Resumo (texto simples, até 400 caracteres)">
              <textarea name="summary" required maxLength={400} rows={2} defaultValue={current?.summary || ''} className={inputClass} />
            </Field>
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-gray-600">Conteúdo</span>
              <RichTextEditor
                key={editing === 'NEW' ? 'novo' : editing.id}
                name="content"
                maxLength={10000}
                defaultValue={current?.content || ''}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria">
                <select name="category" defaultValue={current?.category || 'INSTITUCIONAL'} className={inputClass}>
                  {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Situação">
                <select name="status" defaultValue={current?.status || 'RASCUNHO'} className={inputClass}>
                  <option value="RASCUNHO">Salvar como rascunho</option>
                  <option value="PUBLICADO">Publicar para associados</option>
                  <option value="ARQUIVADO">Arquivar</option>
                </select>
              </Field>
            </div>
            {current?.attachments?.length ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-gray-500">Anexos publicados</p>
                <div className="space-y-2">
                  {current.attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => downloadPostAttachment(attachment).catch((caught) => setError(caught.message))}
                      className="flex min-h-10 w-full items-center gap-2 rounded-md bg-white px-3 text-left text-sm font-semibold text-blue-700"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 truncate">{attachment.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título do novo anexo (opcional)">
                <input name="attachmentTitle" maxLength={160} className={inputClass} placeholder="Ex.: Relatório da ação" />
              </Field>
              <Field label="Novo anexo (PDF, JPG ou PNG, até 5 MB)">
                <input name="attachment" type="file" accept="application/pdf,image/jpeg,image/png" className={inputClass} />
              </Field>
            </div>
            <p className="text-xs leading-relaxed text-gray-500">
              Somente itens com a situação “Publicado” aparecem no Portal do Associado. Você pode
              anexar outros arquivos editando o comunicado novamente.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className={secondaryClass}>Cancelar</button>
              <button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Salvando…' : 'Salvar comunicado'}</button>
            </div>
          </form>
        </Dialog>
      )}
    </section>
  );
}
