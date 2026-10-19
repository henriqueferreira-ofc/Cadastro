import React, { useEffect, useState } from 'react';
import { Download, Plus, Wallet, CheckCircle2, FileCheck2 } from 'lucide-react';
import {
  AdminPaymentProof,
  ExemptionRequest,
  downloadEntryAttachment,
  MonthlyFee,
  downloadPaymentProof,
  managementApi,
  money,
  parseMoney,
  today,
  shortDate,
  monthLabel,
  feeStatus,
  monthRange,
  matchesAssociate,
  paymentMethods,
  csvCell,
} from '../../management_service';
import { formatCPF } from '../../utils';
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

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export default function FinancePage() {
  const { associates, loading: associateLoading, error: associateError, retry } = useAssociates();
  const [fees, setFees] = useState<MonthlyFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [year, setYear] = useState(today().slice(0, 4));
  const [monthNum, setMonthNum] = useState(today().slice(5, 7));
  const month = year && monthNum ? `${year}-${monthNum}` : '';
  const setMonth = (value: string) => {
    setYear(value ? value.slice(0, 4) : '');
    setMonthNum(value ? value.slice(5, 7) : '');
  };
  const currentYear = Number(today().slice(0, 4));
  const filterYears = Array.from({ length: currentYear + 2 - 2024 }, (_, index) =>
    String(currentYear + 1 - index),
  );
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('TODOS');
  const [revision, setRevision] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState('');
  const [newMonth, setNewMonth] = useState(today().slice(0, 7));
  const [paymentFee, setPaymentFee] = useState<MonthlyFee | null>(null);
  const [detail, setDetail] = useState<MonthlyFee | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [proofs, setProofs] = useState<AdminPaymentProof[]>([]);
  const [proofFilter, setProofFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [exempting, setExempting] = useState(false);
  const [exemptStart, setExemptStart] = useState(today().slice(0, 7));
  const [exemptMonths, setExemptMonths] = useState(1);
  const [exemptReason, setExemptReason] = useState('');
  const [exemptRequest, setExemptRequest] = useState<ExemptionRequest | null>(null);
  const [requests, setRequests] = useState<ExemptionRequest[]>([]);
  const [declining, setDeclining] = useState<ExemptionRequest | null>(null);
  const [rejecting, setRejecting] = useState<AdminPaymentProof | null>(null);
  const [approving, setApproving] = useState<AdminPaymentProof | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    managementApi<MonthlyFee[]>(
      `/mensalidades${month ? `?competence=${month}` : ''}`,
      undefined,
      controller.signal,
    )
      .then((rows) =>
        setFees(
          year && !month ? rows.filter((fee) => fee.competence.startsWith(`${year}-`)) : rows,
        ),
      )
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setFees([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, year, revision]);
  useEffect(() => {
    managementApi<ExemptionRequest[]>('/isencoes/pedidos')
      .then(setRequests)
      .catch(() => setRequests([]));
  }, [revision]);
  useEffect(() => {
    managementApi<AdminPaymentProof[]>('/comprovantes')
      .then(setProofs)
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : 'Não foi possível carregar os comprovantes.',
        ),
      );
  }, [revision]);
  const filtered = fees.filter(
    (fee) =>
      matchesAssociate(fee.cadastro, search) && (status === 'TODOS' || feeStatus(fee) === status),
  );
  const received = filtered.reduce((sum, fee) => sum + (fee.payment?.amountCents || 0), 0);
  const open = filtered
    .filter((fee) => !fee.payment && !fee.exemption)
    .reduce((sum, fee) => sum + fee.amountCents, 0);
  const overdue = filtered
    .filter((fee) => feeStatus(fee) === 'VENCIDO')
    .reduce((sum, fee) => sum + fee.amountCents, 0);
  const statusText = { PAGO: 'Pago', ABERTO: 'Em aberto', VENCIDO: 'Vencido', ISENTO: 'Isento' };
  const statusStyle = {
    PAGO: 'bg-green-50 text-green-700',
    ABERTO: 'bg-amber-50 text-amber-800',
    VENCIDO: 'bg-red-50 text-red-700',
    ISENTO: 'bg-violet-50 text-violet-700',
  };
  async function createFee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setFormError('');
    setBusy(true);
    try {
      await managementApi('/mensalidades', {
        cadastroId: Number(selected),
        competence: newMonth,
        amountCents: parseMoney(String(form.get('amount'))),
        dueDate: form.get('dueDate'),
        notes: form.get('notes') || '',
      });
      setShowNew(false);
      setMonth(newMonth);
      setSearch('');
      setStatus('TODOS');
      setRevision((v) => v + 1);
      setMessage('Mensalidade criada. Nenhuma cobrança foi enviada ao associado.');
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function registerPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !paymentFee) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError('');
    try {
      await managementApi(`/mensalidades/${paymentFee.id}/pagamento`, {
        paidAt: form.get('paidAt'),
        method: form.get('method'),
        reference: form.get('reference') || '',
      });
      setPaymentFee(null);
      setRevision((v) => v + 1);
      setMessage('Pagamento registrado.');
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function openExemption(request: ExemptionRequest | null = null) {
    setFormError('');
    setExemptRequest(request);
    setSelected(request ? String(request.cadastro.id) : '');
    setExemptReason(request ? request.description.slice(0, 1000) : '');
    setExemptMonths(1);
    setExemptStart(month || today().slice(0, 7));
    setExempting(true);
  }
  async function grantExemption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selected) return;
    setBusy(true);
    setFormError('');
    try {
      const result = await managementApi<{ granted: number; skipped: number; blocked: string[] }>(
        '/isencoes',
        {
          cadastroId: Number(selected),
          competences: monthRange(exemptStart, exemptMonths),
          reason: exemptReason,
          ...(exemptRequest ? { requestId: exemptRequest.id } : {}),
        },
      );
      setExempting(false);
      setExemptRequest(null);
      setMonth(exemptStart);
      setSearch('');
      setStatus('TODOS');
      setRevision((v) => v + 1);
      setMessage(
        `Isenção concedida em ${result.granted} mês(es)` +
          (result.skipped ? `; ${result.skipped} já estava(m) isento(s)` : '') +
          (result.blocked.length
            ? `; mantidos sem alteração por já estarem pagos ou em análise: ${result.blocked
                .map(monthLabel)
                .join(', ')}`
            : '') +
          '. O associado vê o motivo no portal.',
      );
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Não foi possível isentar.');
    } finally {
      setBusy(false);
    }
  }
  async function declineRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !declining) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError('');
    try {
      await managementApi(`/isencoes/pedidos/${declining.id}/recusar`, {
        reason: form.get('reason'),
      });
      setDeclining(null);
      setRevision((v) => v + 1);
      setMessage('Pedido recusado. O associado verá o motivo na Secretaria do portal.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Não foi possível recusar.');
    } finally {
      setBusy(false);
    }
  }
  async function revokeExemption(fee: MonthlyFee) {
    if (busy || !window.confirm(`Revogar a isenção de ${monthLabel(fee.competence)}?`)) return;
    setBusy(true);
    setError('');
    try {
      await managementApi(`/mensalidades/${fee.id}/isencao/revogar`, {});
      setRevision((v) => v + 1);
      setMessage('Isenção revogada. A mensalidade volta a ser cobrada.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível revogar a isenção.');
    } finally {
      setBusy(false);
    }
  }
  async function approveProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !approving) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    setFormError('');
    try {
      await managementApi(`/comprovantes/${approving.id}/aprovar`, {
        paidAt: form.get('paidAt'),
        ...(!approving.fee ? { dueDate: form.get('dueDate') } : {}),
      });
      setApproving(null);
      setMessage('Comprovante aprovado e pagamento registrado com o valor da mensalidade.');
      setRevision((value) => value + 1);
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'Não foi possível aprovar o comprovante.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function rejectProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !rejecting) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError('');
    try {
      await managementApi(`/comprovantes/${rejecting.id}/recusar`, { reason: form.get('reason') });
      setRejecting(null);
      setMessage('Comprovante recusado. O associado verá o motivo e poderá enviar outro.');
      setRevision((value) => value + 1);
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : 'Não foi possível recusar o comprovante.',
      );
    } finally {
      setBusy(false);
    }
  }
  function exportReport() {
    const rows: unknown[][] = [
      [
        'Associado',
        'CPF',
        'Referência',
        'Vencimento',
        'Valor (R$)',
        'Situação',
        'Pago em',
        'Recebido (R$)',
        'Forma de pagamento',
        'Comprovante / referência',
        'Observações',
      ],
      ...filtered.map((fee) => [
        fee.cadastro.nome,
        formatCPF(fee.cadastro.cpf),
        monthLabel(fee.competence),
        shortDate(fee.dueDate),
        (fee.amountCents / 100).toFixed(2).replace('.', ','),
        statusText[feeStatus(fee)],
        shortDate(fee.payment?.paidAt),
        ((fee.payment?.amountCents || 0) / 100).toFixed(2).replace('.', ','),
        fee.payment ? paymentMethods[fee.payment.method] : '',
        fee.payment?.reference || '',
        fee.exemption ? `Isento: ${fee.exemption.reason}` : fee.notes,
      ]),
      [],
      ['RESUMO'],
      ['Mês de referência', month ? monthLabel(month) : 'Todos'],
      ['Filtro de associado', search || 'Todos'],
      [
        'Filtro de situação',
        status === 'TODOS' ? 'Todas' : statusText[status as keyof typeof statusText],
      ],
      ['Mensalidades exibidas', filtered.length],
      ['Total recebido (R$)', (received / 100).toFixed(2).replace('.', ',')],
      ['Total em aberto (R$)', (open / 100).toFixed(2).replace('.', ',')],
      ['Do aberto, vencido (R$)', (overdue / 100).toFixed(2).replace('.', ',')],
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `financeiro-${month || 'todos'}-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Financeiro</h2>
          <p className="mt-1 text-sm text-gray-500">
            Mensalidades e registro manual de pagamentos.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button
            className={secondaryClass}
            disabled={loading || !!error || !filtered.length}
            onClick={exportReport}
          >
            <Download className="mr-1 inline h-4 w-4" />
            Exportar relatório
          </button>
          <button
            className={secondaryClass}
            disabled={associateLoading || !!associateError || loading || !!error}
            onClick={() => openExemption()}
          >
            Isentar associado
          </button>
          <button
            className={primaryClass}
            disabled={associateLoading || !!associateError || loading || !!error}
            onClick={() => {
              setFormError('');
              setSelected('');
              setNewMonth(month || today().slice(0, 7));
              setShowNew(true);
            }}
          >
            <Plus className="mr-1 inline h-4 w-4" />
            Nova mensalidade
          </button>
        </div>
      </div>
      <Notice error={error || associateError} message={message} />
      {associateError && (
        <button className={secondaryClass} onClick={retry}>
          Recarregar associados
        </button>
      )}
      <section className="overflow-hidden rounded-xl border border-blue-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-gray-900">Comprovantes enviados pelo portal</h3>
              <p className="text-xs text-gray-500">
                {proofs.filter((proof) => proof.status === 'PENDING').length} aguardando aprovação
              </p>
            </div>
          </div>
          <select
            value={proofFilter}
            onChange={(event) => setProofFilter(event.target.value as 'PENDING' | 'ALL')}
            className={inputClass}
            aria-label="Filtrar comprovantes"
          >
            <option value="PENDING">Aguardando análise</option>
            <option value="ALL">Todos os comprovantes</option>
          </select>
        </div>
        <div className="divide-y divide-gray-100">
          {proofs
            .filter((proof) => proofFilter === 'ALL' || proof.status === 'PENDING')
            .slice(0, 30)
            .map((proof) => (
              <article
                key={proof.id}
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.4fr)_1fr_auto] sm:items-center sm:p-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-900">{proof.cadastro.nome}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatCPF(proof.cadastro.cpf)} · {monthLabel(proof.competence)} ·{' '}
                    {money(proof.amountCents)}
                  </p>
                  {proof.rejectionReason && (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                      Motivo: {proof.rejectionReason}
                    </p>
                  )}
                </div>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                      proof.status === 'PENDING'
                        ? 'bg-blue-50 text-blue-700'
                        : proof.status === 'APPROVED'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {proof.status === 'PENDING'
                      ? 'Em análise'
                      : proof.status === 'APPROVED'
                        ? 'Aprovado'
                        : 'Recusado'}
                  </span>
                  <p className="mt-1 text-xs text-gray-400">
                    Enviado em {shortDate(proof.submittedAt)}
                  </p>
                  {proof.reviewedAt && (
                    <p className="mt-1 text-xs text-gray-400">
                      {proof.status === 'APPROVED' ? 'Aprovado' : 'Recusado'} em{' '}
                      {shortDate(proof.reviewedAt)}
                      {proof.reviewedBy ? ` por ${proof.reviewedBy}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <button
                    type="button"
                    className={secondaryClass}
                    onClick={() =>
                      downloadPaymentProof(proof).catch((caught) => setError(caught.message))
                    }
                  >
                    <Download className="mr-1 inline h-4 w-4" /> Abrir
                  </button>
                  {proof.status === 'PENDING' && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        className={primaryClass}
                        onClick={() => {
                          setFormError('');
                          setApproving(proof);
                        }}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700"
                        onClick={() => {
                          setFormError('');
                          setRejecting(proof);
                        }}
                      >
                        Recusar
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          {!proofs.filter((proof) => proofFilter === 'ALL' || proof.status === 'PENDING')
            .length && (
            <p className="p-8 text-center text-sm text-gray-500">
              Nenhum comprovante neste filtro.
            </p>
          )}
        </div>
      </section>
      {!!requests.length && (
        <section className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
          <div className="border-b border-violet-100 bg-violet-50 px-4 py-3 sm:px-5">
            <h3 className="font-bold text-violet-900">Pedidos de isenção encaminhados</h3>
            <p className="text-xs text-violet-700">
              {requests.length} aguardando decisão do Financeiro, já conferidos pela Secretaria.
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {requests.map((request) => (
              <article key={request.id} className="space-y-3 p-4 sm:p-5">
                <div>
                  <p className="text-sm font-bold text-gray-900">{request.cadastro.nome}</p>
                  <p className="text-xs text-gray-500">
                    {formatCPF(request.cadastro.cpf)} · pedido #{request.id} · enviado em{' '}
                    {shortDate(request.createdAt)}
                  </p>
                </div>
                <p className="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  {request.description}
                </p>
                {!!request.attachments.length && (
                  <div className="flex flex-wrap gap-2">
                    {request.attachments.map((file) => (
                      <button
                        key={file.id}
                        className={secondaryClass}
                        onClick={() =>
                          downloadEntryAttachment(file).catch((caught) =>
                            setError(caught instanceof Error ? caught.message : 'Falha ao baixar.'),
                          )
                        }
                      >
                        <Download className="mr-1 inline h-4 w-4" />
                        {file.fileName}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className={primaryClass} onClick={() => openExemption(request)}>
                    Analisar e isentar
                  </button>
                  <button
                    className={secondaryClass}
                    onClick={() => {
                      setFormError('');
                      setDeclining(request);
                    }}
                  >
                    Recusar pedido
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <div
        className={`${panelClass} grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[280px_minmax(0,1fr)_160px_auto]`}
      >
        <Field label="Mês de referência">
          <div className="grid grid-cols-[1fr_84px] gap-2">
            <select
              className={inputClass}
              value={monthNum}
              onChange={(e) => {
                setMonthNum(e.target.value);
                if (e.target.value && !year) setYear(String(currentYear));
                setMessage('');
              }}
            >
              <option value="">Todos os meses</option>
              {monthNames.map((name, index) => (
                <option key={name} value={String(index + 1).padStart(2, '0')}>
                  {name}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              aria-label="Ano"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                if (!e.target.value) setMonthNum('');
                setMessage('');
              }}
            >
              <option value="">Todos</option>
              {filterYears.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Associado">
          <input
            className={inputClass}
            placeholder="Buscar por nome ou CPF"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field label="Situação">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="TODOS">Todas</option>
            <option value="ABERTO">Em aberto</option>
            <option value="VENCIDO">Vencido</option>
            <option value="PAGO">Pago</option>
            <option value="ISENTO">Isento</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            className={secondaryClass}
            onClick={() => {
              setMonth('');
              setStatus('TODOS');
              setSearch('');
            }}
          >
            Todos os meses
          </button>
          <button
            className={secondaryClass}
            disabled={loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            Atualizar
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Recebido" value={loading || error ? '—' : money(received)} />
        <Stat label="Em aberto (inclui vencidos)" value={loading || error ? '—' : money(open)} />
        <Stat label="Do valor em aberto, vencido" value={loading || error ? '—' : money(overdue)} />
      </div>
      <p className="text-xs text-gray-500">
        Os totais e a exportação consideram as mensalidades dos filtros acima, pelo mês de
        referência. “Recebido” inclui os pagamentos dessas mensalidades, independentemente da data
        do pagamento.
      </p>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-gray-600">
          {loading ? 'Carregando mensalidades…' : `${filtered.length} mensalidade(s)`}
        </div>
        {!loading && !error && !filtered.length ? (
          <div className="px-6 py-14 text-center">
            <Wallet className="mx-auto mb-3 h-10 w-10 text-blue-300" />
            <h3 className="font-semibold text-gray-700">Nenhuma mensalidade encontrada</h3>
            <p className="mt-2 text-sm text-gray-500">
              Crie a primeira mensalidade ou ajuste os filtros.
            </p>
          </div>
        ) : (
          !loading &&
          !error && (
            <div className="px-3 pb-3 sm:overflow-x-auto sm:p-0">
              <table className="mobile-records w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                  <tr>
                    {['Associado', 'Referência', 'Vencimento', 'Valor', 'Situação', 'Ações'].map(
                      (label) => (
                        <th key={label} className="whitespace-nowrap px-4 py-3">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((fee) => (
                    <tr key={fee.id}>
                      <td
                        data-label="Associado"
                        className="mobile-record-title sm:min-w-[210px] px-4 py-4"
                      >
                        <p className="font-semibold text-gray-700">{fee.cadastro.nome}</p>
                        <p className="mt-1 text-xs text-gray-400">{formatCPF(fee.cadastro.cpf)}</p>
                      </td>
                      <td data-label="Referência" className="px-4 py-4 text-gray-600">
                        {monthLabel(fee.competence)}
                      </td>
                      <td
                        data-label="Vencimento"
                        className="whitespace-nowrap px-4 py-4 text-gray-600"
                      >
                        {shortDate(fee.dueDate)}
                      </td>
                      <td
                        data-label="Valor"
                        className="whitespace-nowrap px-4 py-4 font-semibold text-gray-800"
                      >
                        {money(fee.amountCents)}
                      </td>
                      <td data-label="Situação" className="px-4 py-4">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${statusStyle[feeStatus(fee)]}`}
                        >
                          {statusText[feeStatus(fee)]}
                        </span>
                      </td>
                      <td data-label="Ações" className="px-4 py-4">
                        <div className="flex flex-col items-start gap-2">
                          {fee.exemption && (
                            <button
                              className="min-h-11 rounded-lg bg-violet-50 px-3 text-xs font-semibold text-violet-700 hover:underline sm:min-h-0 sm:whitespace-nowrap sm:bg-transparent sm:px-0"
                              onClick={() => void revokeExemption(fee)}
                            >
                              Revogar isenção
                            </button>
                          )}
                          {!fee.payment && !fee.exemption && (
                            <button
                              className="min-h-11 rounded-lg bg-blue-50 px-3 text-xs font-semibold text-blue-600 hover:underline sm:min-h-0 sm:whitespace-nowrap sm:bg-transparent sm:px-0"
                              onClick={() => {
                                setFormError('');
                                setPaymentFee(fee);
                              }}
                            >
                              Registrar pagamento
                            </button>
                          )}
                          <button
                            className="min-h-11 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-500 hover:underline sm:min-h-0 sm:border-0 sm:px-0"
                            onClick={() => setDetail(fee)}
                          >
                            Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
      {showNew && (
        <Dialog title="Nova mensalidade" onClose={() => setShowNew(false)} busy={busy}>
          <form className="space-y-4" onSubmit={createFee}>
            <Notice error={formError} />
            <AssociatePicker
              associates={associates}
              selected={selected}
              onSelect={setSelected}
              disabled={busy}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mês de referência">
                <input
                  required
                  type="month"
                  min="2000-01"
                  max="2100-12"
                  value={newMonth}
                  onChange={(e) => setNewMonth(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Valor (R$)">
                <input
                  required
                  name="amount"
                  inputMode="decimal"
                  placeholder="50,00"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Vencimento">
              <input
                required
                name="dueDate"
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                className={inputClass}
              />
            </Field>
            <Field label="Observações (opcional)">
              <textarea name="notes" rows={3} maxLength={2000} className={inputClass} />
            </Field>
            <p className="text-xs text-gray-500">
              Uma mensalidade por associado e mês. Este registro não envia cobrança nem altera a
              liberação do CPF.
            </p>
            <button disabled={busy || !selected} className={primaryClass}>
              {busy ? 'Salvando…' : 'Criar mensalidade'}
            </button>
          </form>
        </Dialog>
      )}
      {exempting && (
        <Dialog
          title="Isentar associado"
          onClose={() => {
            setExempting(false);
            setExemptRequest(null);
          }}
          busy={busy}
        >
          <form className="space-y-4" onSubmit={grantExemption}>
            <Notice error={formError} />
            {exemptRequest && (
              <div className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
                Pedido #{exemptRequest.id} de {exemptRequest.cadastro.nome}. Ao conceder, o pedido é
                concluído e o associado é avisado na Secretaria do portal.
              </div>
            )}
            <AssociatePicker
              associates={associates}
              selected={selected}
              onSelect={setSelected}
              disabled={busy || !!exemptRequest}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="A partir de">
                <input
                  required
                  type="month"
                  min="2000-01"
                  max="2100-12"
                  value={exemptStart}
                  onChange={(e) => setExemptStart(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Quantidade de meses (1 a 60)">
                <input
                  required
                  type="number"
                  min={1}
                  max={60}
                  value={exemptMonths}
                  onChange={(e) =>
                    setExemptMonths(Math.min(60, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryClass}
                onClick={() => {
                  setExemptStart(`${exemptStart.slice(0, 4)}-01`);
                  setExemptMonths(12);
                }}
              >
                Ano inteiro ({exemptStart.slice(0, 4)})
              </button>
              {[1, 3, 6, 12].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={secondaryClass}
                  onClick={() => setExemptMonths(count)}
                >
                  {count} {count === 1 ? 'mês' : 'meses'}
                </button>
              ))}
            </div>
            <p className="text-sm font-semibold text-violet-800">
              Período: {monthLabel(exemptStart)} a{' '}
              {monthLabel(monthRange(exemptStart, exemptMonths).slice(-1)[0])} ({exemptMonths}{' '}
              {exemptMonths === 1 ? 'mês' : 'meses'})
            </p>
            <Field label="Justificativa (o associado verá este texto)">
              <textarea
                required
                value={exemptReason}
                onChange={(e) => setExemptReason(e.target.value)}
                rows={3}
                maxLength={1000}
                className={inputClass}
                placeholder="Ex.: associado desempregado, conforme pedido enviado à Secretaria."
              />
            </Field>
            <p className="text-xs text-gray-500">
              Os meses isentos aparecem como “Isento”, sem cobrança, no lugar de em aberto, vencido
              ou pago. Meses já pagos ou com comprovante em análise são preservados. A isenção pode
              ser revogada depois.
            </p>
            <button disabled={busy || !selected} className={primaryClass}>
              {busy ? 'Salvando…' : 'Conceder isenção'}
            </button>
          </form>
        </Dialog>
      )}
      {declining && (
        <Dialog title="Recusar pedido de isenção" onClose={() => setDeclining(null)} busy={busy}>
          <form className="space-y-4" onSubmit={declineRequest}>
            <Notice error={formError} />
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
              Pedido de {declining.cadastro.nome} (#{declining.id}).
            </div>
            <Field label="Motivo que será mostrado ao associado">
              <textarea
                autoFocus
                required
                name="reason"
                rows={4}
                maxLength={1000}
                className={inputClass}
                placeholder="Ex.: documento comprobatório não anexado."
              />
            </Field>
            <button
              disabled={busy}
              className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Salvando…' : 'Confirmar recusa'}
            </button>
          </form>
        </Dialog>
      )}
      {paymentFee && (
        <Dialog title="Registrar pagamento" onClose={() => setPaymentFee(null)} busy={busy}>
          <form className="space-y-4" onSubmit={registerPayment}>
            <Notice error={formError} />
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="font-semibold text-blue-900">{paymentFee.cadastro.nome}</p>
              <p className="mt-1 text-sm text-blue-700">
                Referência: {monthLabel(paymentFee.competence)} · {money(paymentFee.amountCents)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data do pagamento">
                <input
                  required
                  name="paidAt"
                  type="date"
                  min="2000-01-01"
                  max={today()}
                  defaultValue={today()}
                  className={inputClass}
                />
              </Field>
              <Field label="Forma de pagamento">
                <select required name="method" className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {Object.entries(paymentMethods).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Comprovante / referência (opcional)">
              <input
                name="reference"
                maxLength={500}
                placeholder="Ex.: identificação do Pix ou recibo"
                className={inputClass}
              />
            </Field>
            <p className="text-xs text-gray-500">
              Registre somente após confirmar o recebimento integral. Nesta versão, a baixa é
              integral e não há estorno pela tela.
            </p>
            <button disabled={busy} className={primaryClass}>
              <CheckCircle2 className="mr-1 inline h-4 w-4" />
              {busy ? 'Registrando…' : `Confirmar recebimento de ${money(paymentFee.amountCents)}`}
            </button>
          </form>
        </Dialog>
      )}
      {approving && (
        <Dialog title="Confirmar pagamento" onClose={() => setApproving(null)} busy={busy}>
          <form onSubmit={approveProof} className="space-y-4">
            <Notice error={formError} />
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-bold">{approving.cadastro.nome}</p>
              <p className="mt-1">
                {monthLabel(approving.competence)} · {money(approving.amountCents)}
              </p>
            </div>
            <Field label="Data do pagamento no comprovante">
              <input
                type="date"
                required
                name="paidAt"
                min="2000-01-01"
                max={today()}
                defaultValue={today()}
                className={inputClass}
              />
            </Field>
            {!approving.fee && (
              <>
                <p className="text-sm text-gray-600">
                  Este mês ainda não foi lançado. Informe o vencimento para registrar a mensalidade
                  e o pagamento ao aprovar.
                </p>
                <Field label="Vencimento da mensalidade">
                  <input
                    type="date"
                    required
                    name="dueDate"
                    min="2000-01-01"
                    max="2100-12-31"
                    className={inputClass}
                  />
                </Field>
              </>
            )}
            <button type="submit" disabled={busy} className={primaryClass}>
              {busy ? 'Confirmando…' : 'Aprovar comprovante e confirmar pagamento'}
            </button>
          </form>
        </Dialog>
      )}
      {rejecting && (
        <Dialog title="Recusar comprovante" onClose={() => setRejecting(null)} busy={busy}>
          <form onSubmit={rejectProof} className="space-y-4">
            <Notice error={formError} />
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-900">
              <p className="font-bold">{rejecting.cadastro.nome}</p>
              <p className="mt-1">
                {monthLabel(rejecting.competence)} · {money(rejecting.amountCents)}
              </p>
            </div>
            <Field label="Motivo que será mostrado ao associado">
              <textarea
                autoFocus
                required
                name="reason"
                maxLength={1000}
                rows={4}
                className={inputClass}
                placeholder="Ex.: arquivo ilegível ou valor não identificado."
              />
            </Field>
            <button
              disabled={busy}
              className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Salvando…' : 'Confirmar recusa'}
            </button>
          </form>
        </Dialog>
      )}
      {detail && (
        <Dialog title="Detalhes da mensalidade" onClose={() => setDetail(null)}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ['Associado', detail.cadastro.nome],
              ['CPF', formatCPF(detail.cadastro.cpf)],
              ['Referência', monthLabel(detail.competence)],
              ['Vencimento', shortDate(detail.dueDate)],
              ['Valor', money(detail.amountCents)],
              ['Situação', statusText[feeStatus(detail)]],
              ['Criada em', shortDate(detail.createdAt)],
              ['Pagamento', shortDate(detail.payment?.paidAt)],
              ['Forma', detail.payment ? paymentMethods[detail.payment.method] : '—'],
              ['Referência do pagamento', detail.payment?.reference || '—'],
              ['Isenção', detail.exemption ? detail.exemption.reason : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-400">{label}</dt>
                <dd className="mt-1 break-words text-gray-700">{value}</dd>
              </div>
            ))}
          </dl>
          {detail.notes && (
            <p className="mt-5 whitespace-pre-wrap break-words border-t pt-4 text-sm text-gray-600">
              {detail.notes}
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
}
