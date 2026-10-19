import React, { useEffect, useState } from 'react';
import { Download, FileText, Plus, FolderOpen, MessageCircle } from 'lucide-react';
import {
  managementApi,
  OfficeData,
  OfficeEntry,
  EntryKind,
  EntryStatus,
  kindLabels,
  statusLabels,
  shortDate,
  dateTime,
  today,
  fileBase64,
  downloadDocument,
} from '../../management_service';
import { formatCPF, formatPhone, formatCEP } from '../../utils';
import {
  AssociatePicker,
  Dialog,
  Field,
  Notice,
  Stat,
  useAssociates,
  inputClass,
  panelClass,
  primaryClass,
  secondaryClass,
} from './Shared';

const emptyData: OfficeData = { entries: [], documents: [] };
const statusStyle = {
  ABERTO: 'bg-amber-50 text-amber-800',
  EM_ANDAMENTO: 'bg-blue-50 text-blue-700',
  CONCLUIDO: 'bg-green-50 text-green-700',
};

type InboxEntry = Omit<OfficeEntry, 'events'> & {
  cadastro: { id: number; nome: string; cpf: string };
};

export default function SecretaryPage() {
  const { associates, loading, error: associateError, retry } = useAssociates();
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState('ficha');
  const [data, setData] = useState<OfficeData>(emptyData);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState<'entry' | 'document' | null>(null);
  const [editing, setEditing] = useState<OfficeEntry | null>(null);
  const [formError, setFormError] = useState('');
  const [kind, setKind] = useState<EntryKind>('ATENDIMENTO');
  const [entryFilter, setEntryFilter] = useState('TODOS');
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [replying, setReplying] = useState<OfficeEntry | null>(null);
  const associate = associates.find((a) => String(a.id) === selected);
  useEffect(() => {
    const controller = new AbortController();
    setData(emptyData);
    setError('');
    setMessage('');
    if (!selected) {
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    managementApi<OfficeData>(`/secretaria/${selected}`, undefined, controller.signal)
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDataLoading(false);
      });
    return () => controller.abort();
  }, [selected, revision]);

  useEffect(() => {
    managementApi<InboxEntry[]>('/secretaria/solicitacoes')
      .then(setInbox)
      .catch(() => setInbox([]));
  }, [revision]);

  const refresh = async () => {
    try {
      setData(await managementApi<OfficeData>(`/secretaria/${selected}`));
    } catch {
      setError('Registro salvo, mas a lista não pôde ser atualizada. Clique em Atualizar.');
    }
  };
  const openModal = (value: 'entry' | 'document') => {
    setFormError('');
    setKind('ATENDIMENTO');
    setModal(value);
  };
  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError('');
    setMessage('');
    try {
      await managementApi('/secretaria', {
        cadastroId: Number(selected),
        kind,
        title: form.get('title'),
        description: form.get('description'),
        dueDate: form.get('dueDate') || null,
        visibleToMember: form.get('visibleToMember') === 'on',
      });
      setModal(null);
      setTab(kind === 'OBSERVACAO' ? 'historico' : 'registros');
      setMessage('Registro salvo na ficha do associado.');
      await refresh();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !editing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError('');
    try {
      await managementApi(`/secretaria/registros/${editing.id}/historico`, {
        status: form.get('status'),
        note: form.get('note'),
      });
      setEditing(null);
      setMessage('Histórico atualizado.');
      await refresh();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !replying) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError('');
    try {
      await managementApi(`/secretaria/registros/${replying.id}/respostas`, {
        content: form.get('content'),
        status: form.get('status'),
      });
      setReplying(null);
      setMessage('Resposta enviada ao Portal do Associado.');
      await refresh();
      setRevision((value) => value + 1);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleVisibility(entry: OfficeEntry) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await managementApi(`/secretaria/registros/${entry.id}/visibilidade`, {
        visibleToMember: !entry.visibleToMember,
      });
      setMessage(
        entry.visibleToMember
          ? 'O registro voltou a ser interno da Secretaria.'
          : 'O registro agora está visível no Portal do Associado.',
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível alterar a visibilidade.');
    } finally {
      setBusy(false);
    }
  }
  async function saveDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const file = form.get('file') as File;
    setBusy(true);
    setFormError('');
    try {
      if (!file?.size || file.size > 5 * 1024 * 1024)
        throw new Error('Escolha um arquivo de até 5 MB.');
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))
        throw new Error('Use PDF, JPG ou PNG.');
      await managementApi('/documentos', {
        cadastroId: Number(selected),
        title: form.get('title'),
        fileName: file.name,
        mimeType: file.type,
        content: await fileBase64(file),
      });
      setModal(null);
      setTab('documentos');
      setMessage('Documento anexado à ficha.');
      await refresh();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = data.entries.filter((e) => e.status !== 'CONCLUIDO');
  const entries = data.entries.filter(
    (e) => e.kind !== 'OBSERVACAO' && (entryFilter === 'TODOS' || e.status === entryFilter),
  );
  const timeline = data.entries
    .flatMap((entry) => [
      {
        key: `entry-${entry.id}`,
        date: entry.createdAt,
        title: `${kindLabels[entry.kind]}: ${entry.title}`,
        text: entry.description,
      },
      ...entry.events
        .filter((e) => e.note !== 'Registro criado.')
        .map((e) => ({
          key: `event-${e.id}`,
          date: e.createdAt,
          title: `${entry.title} · ${statusLabels[e.status]}`,
          text: e.note,
        })),
    ])
    .concat(
      data.documents.map((d) => ({
        key: `doc-${d.id}`,
        date: d.createdAt,
        title: `Documento: ${d.title}`,
        text: d.fileName,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Secretaria</h2>
        <p className="mt-1 text-sm text-gray-500">
          Fichas, atendimentos e documentos dos associados.
        </p>
      </div>
      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-gray-900">Solicitações recebidas pelo portal</h3>
            <p className="text-xs text-gray-500">
              {inbox.filter((item) => item.status !== 'CONCLUIDO').length} aguardando atendimento
            </p>
          </div>
        </div>
        {inbox.length ? (
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {inbox.slice(0, 8).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelected(String(item.cadastro.id));
                  setTab('registros');
                  setEntryFilter('TODOS');
                }}
                className="rounded-lg border border-gray-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-800">{item.title}</span>
                    <span className="mt-1 block truncate text-xs text-gray-500">
                      {item.cadastro.nome} · {formatCPF(item.cadastro.cpf)}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle[item.status]}`}>
                    {statusLabels[item.status]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
            Nenhuma solicitação recebida pelo portal.
          </p>
        )}
      </section>
      <Notice error={associateError} />
      {associateError && (
        <button className={secondaryClass} onClick={retry}>
          Tentar novamente
        </button>
      )}
      {loading ? (
        <p role="status" className={panelClass}>
          Carregando associados…
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={panelClass}>
            <h3 className="mb-4 font-bold text-gray-800">Localizar associado</h3>
            <AssociatePicker
              associates={associates}
              selected={selected}
              onSelect={(id) => {
                setSelected(id);
                setTab('ficha');
                setEntryFilter('TODOS');
              }}
              disabled={busy}
            />
            {associate && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="text-sm font-bold text-gray-800">{associate.nome}</p>
                <p className="mt-1 text-xs text-gray-500">{formatCPF(associate.cpf)}</p>
                <p className="mt-2 break-words text-xs text-gray-500">{associate.email}</p>
              </div>
            )}
          </aside>
          {!associate ? (
            <div className={`${panelClass} py-16 text-center`}>
              <FolderOpen className="mx-auto mb-4 h-10 w-10 text-blue-300" />
              <h3 className="font-semibold text-gray-700">Selecione um associado</h3>
              <p className="mt-2 text-sm text-gray-500">
                Busque pelo nome ou CPF para abrir a ficha e os registros da Secretaria.
              </p>
            </div>
          ) : (
            <div className="min-w-0 space-y-4">
              <Notice error={error} message={message} />
              {dataLoading ? (
                <p role="status" className={panelClass}>
                  Carregando ficha…
                </p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Stat label="Em aberto" value={pending.length} />
                    <Stat label="Documentos" value={data.documents.length} />
                    <Stat
                      label="Observações"
                      value={data.entries.filter((e) => e.kind === 'OBSERVACAO').length}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                      className={primaryClass}
                      disabled={busy || !!error}
                      onClick={() => openModal('entry')}
                    >
                      <Plus className="mr-1 inline h-4 w-4" />
                      Novo registro
                    </button>
                    <button
                      className={secondaryClass}
                      disabled={busy || !!error}
                      onClick={() => openModal('document')}
                    >
                      Anexar documento
                    </button>
                    <button
                      className={secondaryClass}
                      disabled={busy}
                      onClick={() => setRevision((v) => v + 1)}
                    >
                      Atualizar
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <nav
                      aria-label="Detalhes do associado"
                      className="grid grid-cols-2 border-b border-gray-200 bg-gray-50 sm:flex sm:overflow-x-auto"
                    >
                      {[
                        ['ficha', 'Ficha'],
                        ['registros', 'Atendimentos e pendências'],
                        ['documentos', 'Documentos'],
                        ['historico', 'Histórico'],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          onClick={() => setTab(id)}
                          aria-current={tab === id ? 'page' : undefined}
                          className={`min-h-11 border-b-2 px-2 sm:px-4 py-3 text-xs sm:whitespace-nowrap font-semibold ${tab === id ? 'border-blue-600 bg-white text-blue-600' : 'border-transparent text-gray-500'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </nav>
                    <div className="p-4 sm:p-5">
                      {tab === 'ficha' && (
                        <>
                          <h3 className="mb-4 font-bold text-gray-800">Dados cadastrais</h3>
                          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                            {[
                              ['Nome', associate.nome],
                              ['CPF', formatCPF(associate.cpf)],
                              ['RG', associate.rg],
                              ['Turma CESD', associate.turma_cesd],
                              ['E-mail', associate.email],
                              ['Telefone', formatPhone(associate.telefone)],
                              ['Estado', associate.estado],
                              ['Cidade', associate.cidade],
                              ['Endereço', associate.endereco],
                              ['Bairro', associate.bairro],
                              ['CEP', formatCEP(associate.cep)],
                              ['Cadastro atualizado em', dateTime(associate.data_envio)],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <dt className="text-xs text-gray-400">{label}</dt>
                                <dd className="mt-1 break-words font-medium text-gray-700">
                                  {value || 'Não informado'}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          <p className="mt-6 text-xs text-gray-400">
                            Esta ficha usa os dados já informados no Cadastro.
                          </p>
                        </>
                      )}
                      {tab === 'registros' && (
                        <div className="space-y-4">
                          <Field label="Situação">
                            <select
                              className={inputClass}
                              value={entryFilter}
                              onChange={(e) => setEntryFilter(e.target.value)}
                            >
                              <option value="TODOS">Todas</option>
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {!entries.length && (
                            <p className="py-6 text-center text-sm text-gray-500">
                              Nenhum registro nesta situação.
                            </p>
                          )}
                          {entries.map((entry) => (
                            <article
                              key={entry.id}
                              className="rounded-lg border border-gray-200 p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-gray-400">
                                    {kindLabels[entry.kind]} · #{entry.id}
                                  </p>
                                  <h4 className="mt-1 font-semibold text-gray-800">
                                    {entry.title}
                                  </h4>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyle[entry.status]}`}
                                >
                                  {statusLabels[entry.status]}
                                </span>
                              </div>
                              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-600">
                                {entry.description}
                              </p>
                              {!!entry.messages?.length && (
                                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Conversa</p>
                                  {entry.messages.map((item) => (
                                    <div
                                      key={item.id}
                                      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${item.sender === 'ADMIN' ? 'ml-auto bg-blue-50 text-blue-900' : 'bg-gray-100 text-gray-700'}`}
                                    >
                                      <p className="mb-1 text-[10px] font-bold uppercase opacity-60">
                                        {item.sender === 'ADMIN' ? 'AAFAB' : 'Associado'} · {dateTime(item.createdAt)}
                                      </p>
                                      <p className="whitespace-pre-wrap break-words">{item.content}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p
                                className={`mt-3 text-xs ${entry.dueDate && entry.dueDate.slice(0, 10) < today() && entry.status !== 'CONCLUIDO' ? 'font-semibold text-red-600' : 'text-gray-400'}`}
                              >
                                Prazo: {shortDate(entry.dueDate)} · Criado em{' '}
                                {shortDate(entry.createdAt)}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  className={primaryClass}
                                  disabled={busy || !entry.visibleToMember || entry.kind === 'OBSERVACAO'}
                                  onClick={() => {
                                    setFormError('');
                                    setReplying(entry);
                                  }}
                                >
                                  Responder associado
                                </button>
                                <button
                                  className={secondaryClass}
                                  onClick={() => {
                                    setFormError('');
                                    setEditing(entry);
                                  }}
                                >
                                  Atualizar situação / observação
                                </button>
                                <button
                                  className={secondaryClass}
                                  disabled={busy}
                                  onClick={() => toggleVisibility(entry)}
                                  title="Controla se este registro aparece para o titular"
                                >
                                  {entry.visibleToMember
                                    ? 'Ocultar do associado'
                                    : 'Mostrar ao associado'}
                                </button>
                              </div>
                              <p className="mt-2 text-xs text-gray-400">
                                {entry.visibleToMember
                                  ? 'Visível no Portal do Associado.'
                                  : 'Registro interno da Secretaria.'}
                              </p>
                            </article>
                          ))}
                        </div>
                      )}
                      {tab === 'documentos' && (
                        <div className="space-y-3">
                          {!data.documents.length && (
                            <p className="py-6 text-center text-sm text-gray-500">
                              Nenhum documento anexado.
                            </p>
                          )}
                          {data.documents.map((document) => (
                            <div
                              key={document.id}
                              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
                            >
                              <FileText className="h-5 w-5 shrink-0 text-blue-500" />
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-semibold text-gray-800">
                                  {document.title}
                                </p>
                                <p className="break-words text-xs text-gray-400">
                                  {document.fileName} · {Math.ceil(document.size / 1024)} KB ·{' '}
                                  {shortDate(document.createdAt)}
                                </p>
                              </div>
                              <button
                                className={secondaryClass}
                                aria-label={`Baixar ${document.title}`}
                                onClick={() =>
                                  downloadDocument(document).catch((e) => setError(e.message))
                                }
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {tab === 'historico' && (
                        <div className="space-y-5">
                          {!timeline.length && (
                            <p className="py-6 text-center text-sm text-gray-500">
                              O histórico aparecerá aqui após o primeiro registro.
                            </p>
                          )}
                          {timeline.map((item) => (
                            <article key={item.key} className="border-l-2 border-blue-100 pl-4">
                              <p className="text-xs text-gray-400">{dateTime(item.date)}</p>
                              <h4 className="mt-1 text-sm font-semibold text-gray-800">
                                {item.title}
                              </h4>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600">
                                {item.text}
                              </p>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {modal === 'entry' && (
        <Dialog title="Novo registro da Secretaria" onClose={() => setModal(null)} busy={busy}>
          <form onSubmit={saveEntry} className="space-y-4">
            <Notice error={formError} />
            <p className="text-sm font-semibold text-gray-700">{associate?.nome}</p>
            <Field label="Tipo">
              <select
                className={inputClass}
                value={kind}
                onChange={(e) => setKind(e.target.value as EntryKind)}
              >
                {Object.entries(kindLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assunto">
              <input autoFocus name="title" required maxLength={160} className={inputClass} />
            </Field>
            <Field label="Descrição / observação">
              <textarea
                name="description"
                required
                maxLength={5000}
                rows={4}
                className={inputClass}
              />
            </Field>
            {kind !== 'OBSERVACAO' && (
              <>
                <Field label="Prazo (opcional)">
                  <input
                    type="date"
                    name="dueDate"
                    min="2000-01-01"
                    max="2100-12-31"
                    className={inputClass}
                  />
                </Field>
                <label className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                  <input name="visibleToMember" type="checkbox" className="mt-0.5 h-4 w-4" />
                  <span>
                    <strong className="block">Mostrar no Portal do Associado</strong>
                    O titular verá o assunto, a descrição, a situação e o prazo deste registro.
                  </span>
                </label>
              </>
            )}
            <button disabled={busy} className={primaryClass}>
              {busy ? 'Salvando…' : 'Salvar registro'}
            </button>
          </form>
        </Dialog>
      )}
      {editing && (
        <Dialog title="Atualizar registro" onClose={() => setEditing(null)} busy={busy}>
          <form onSubmit={saveEvent} className="space-y-4">
            <Notice error={formError} />
            <p className="font-semibold text-gray-800">{editing.title}</p>
            <Field label="Situação">
              <select name="status" defaultValue={editing.status} className={inputClass}>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Observação para o histórico">
              <textarea
                autoFocus
                name="note"
                required
                maxLength={5000}
                rows={4}
                className={inputClass}
              />
            </Field>
            <button disabled={busy} className={primaryClass}>
              {busy ? 'Salvando…' : 'Salvar atualização'}
            </button>
          </form>
        </Dialog>
      )}
      {replying && (
        <Dialog title="Responder ao associado" onClose={() => setReplying(null)} busy={busy}>
          <form onSubmit={sendReply} className="space-y-4">
            <Notice error={formError} />
            <p className="font-semibold text-gray-800">{replying.title}</p>
            <Field label="Resposta visível no Portal do Associado">
              <textarea
                autoFocus
                name="content"
                required
                maxLength={5000}
                rows={5}
                className={inputClass}
                placeholder="Escreva a orientação ou resposta da Secretaria."
              />
            </Field>
            <Field label="Situação após responder">
              <select name="status" defaultValue="EM_ANDAMENTO" className={inputClass}>
                <option value="ABERTO">Aberto</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="CONCLUIDO">Concluído</option>
              </select>
            </Field>
            <p className="text-xs text-gray-500">
              Esta mensagem será vista somente pelo titular desta solicitação.
            </p>
            <button disabled={busy} className={primaryClass}>
              {busy ? 'Enviando…' : 'Enviar resposta'}
            </button>
          </form>
        </Dialog>
      )}
      {modal === 'document' && (
        <Dialog title="Anexar documento" onClose={() => setModal(null)} busy={busy}>
          <form onSubmit={saveDocument} className="space-y-4">
            <Notice error={formError} />
            <p className="text-sm font-semibold text-gray-700">{associate?.nome}</p>
            <Field label="Título do documento">
              <input autoFocus name="title" required maxLength={160} className={inputClass} />
            </Field>
            <Field label="Arquivo (PDF, JPG ou PNG, até 5 MB)">
              <input
                name="file"
                type="file"
                required
                accept="application/pdf,image/jpeg,image/png"
                className={inputClass}
              />
            </Field>
            <button disabled={busy} className={primaryClass}>
              {busy ? 'Enviando…' : 'Salvar documento'}
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
