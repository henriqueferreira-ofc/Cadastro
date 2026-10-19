import React, { useEffect, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import { Associate, managementApi, matchesAssociate } from '../../management_service';
import { formatCPF } from '../../utils';

export const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100';
export const primaryClass =
  'min-h-11 sm:min-h-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryClass =
  'min-h-11 sm:min-h-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50';
export const panelClass = 'min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6';

export function Notice({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}
    >
      {error || message}
    </div>
  );
}
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1.5 text-xs font-semibold text-gray-600">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:block sm:p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="shrink-0 text-xl font-bold text-gray-800 sm:mt-2 sm:text-2xl">{value}</p>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Fechar"
          className="min-h-11 min-w-11 shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </dialog>
  );
}
export function useAssociates() {
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    managementApi<Associate[]>('/associados', undefined, controller.signal)
      .then(setAssociates)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  return { associates, loading, error, retry: () => setRevision((r) => r + 1) };
}
export function AssociatePicker({
  associates,
  selected,
  onSelect,
  disabled = false,
}: {
  associates: Associate[];
  selected: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = associates.filter((a) => matchesAssociate(a, search));
  const chosen = associates.find((a) => String(a.id) === selected);
  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">Buscar associado por nome ou CPF</span>
        <Search aria-hidden="true" className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          className={`${inputClass} pl-9`}
          placeholder="Buscar por nome ou CPF"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
        />
      </label>
      <Field label="Associado">
        <select
          required
          className={inputClass}
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          disabled={disabled}
        >
          <option value="">Selecione um associado</option>
          {chosen && !filtered.some((a) => a.id === chosen.id) && (
            <option value={chosen.id}>
              {chosen.nome} · {formatCPF(chosen.cpf)}
            </option>
          )}
          {filtered.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome} · {formatCPF(a.cpf)}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-xs text-gray-400">{filtered.length} associado(s) encontrado(s)</p>
    </div>
  );
}
