import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardEdit,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  LogIn,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { formatCPF, validateCPF } from '../utils';
import { DBService, type RegistrationGuidanceStatus } from '../db_service';
import { MemberService } from '../member_service';
import { BaseAutorizada } from '../types';
import BlockedCpfPixNotice from './BlockedCpfPixNotice';

export type AccessMode = 'LOGIN' | 'ACTIVATE' | 'REGISTER';

interface LoginFormProps {
  initialMode?: AccessMode;
  onRegistrationSuccess: (user: BaseAutorizada) => void;
  onMemberSuccess: () => void;
}

const modes: Array<{
  id: AccessMode;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'LOGIN', label: 'Entrar no portal', mobileLabel: 'Entrar', icon: LogIn },
  { id: 'ACTIVATE', label: 'Primeiro acesso', mobileLabel: '1º acesso', icon: KeyRound },
  { id: 'REGISTER', label: 'Realizar cadastro', mobileLabel: 'Cadastro', icon: ClipboardEdit },
];

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-base font-medium outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

const LoginForm: React.FC<LoginFormProps> = ({
  initialMode = 'LOGIN',
  onRegistrationSuccess,
  onMemberSuccess,
}) => {
  const [mode, setMode] = useState<AccessMode>(initialMode);
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState<
    RegistrationGuidanceStatus | 'UNVERIFIED'
  >('UNVERIFIED');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const changeMode = (next: AccessMode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmation('');
    setAccessCode('');
    setRegistrationStatus('UNVERIFIED');
  };

  const validateCommonCpf = () => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (!validateCPF(cleanCpf)) throw new Error('Por favor, informe um CPF válido.');
    return cleanCpf;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const cleanCpf = validateCommonCpf();

      if (mode === 'LOGIN') {
        if (!password) throw new Error('Informe sua senha.');
        await MemberService.login(cleanCpf, password);
        onMemberSuccess();
        return;
      }

      if (mode === 'ACTIVATE') {
        if (!/^\d{8}$/.test(accessCode)) {
          throw new Error('Informe o código temporário de 8 dígitos fornecido pela AAFAB.');
        }
        if (password.length < 10 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
          throw new Error('Crie uma senha com pelo menos 10 caracteres, uma letra e um número.');
        }
        if (password !== confirmation) throw new Error('A confirmação da senha não confere.');
        await MemberService.activate(cleanCpf, accessCode, password);
        onMemberSuccess();
        return;
      }

      if (registrationStatus === 'ALREADY_REGISTERED') {
        changeMode('ACTIVATE');
        return;
      }
      if (registrationStatus !== 'CODE_READY') {
        setRegistrationStatus(await DBService.registrationGuidance(cleanCpf));
        return;
      }
      if (!/^\d{8}$/.test(accessCode)) {
        throw new Error('Informe o código de liberação de 8 dígitos enviado pela Secretaria.');
      }
      const result = await DBService.checkCPFAsync(cleanCpf, accessCode);
      if (!result.success || !result.data) {
        throw new Error(
          result.error || 'Não foi possível iniciar o cadastro. Procure a Secretaria da AAFAB.',
        );
      }
      onRegistrationSuccess(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir o acesso.');
    } finally {
      setLoading(false);
    }
  };

  const isPasswordMode = mode === 'LOGIN' || mode === 'ACTIVATE';
  const actionLabel =
    mode === 'LOGIN'
      ? 'Entrar no Portal do Associado'
      : mode === 'ACTIVATE'
        ? 'Criar senha e entrar'
        : registrationStatus === 'CODE_READY'
          ? 'Validar código e abrir cadastro'
          : registrationStatus === 'ALREADY_REGISTERED'
            ? 'Ir para o primeiro acesso'
            : registrationStatus === 'UNVERIFIED'
              ? 'Consultar situação do CPF'
              : 'Consultar novamente';

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-lg sm:rounded-2xl sm:shadow-xl">
      <div className="px-4 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-9 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <ShieldCheck aria-hidden="true" className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Portal do Associado AAFAB
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
            Acesse informações da Associação, acompanhe suas solicitações, mensalidades e dados
            cadastrais.
          </p>
        </div>

        <nav
          aria-label="Formas de acesso"
          className="mx-auto mt-6 grid max-w-2xl grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 sm:mt-8 sm:gap-2"
        >
          {modes.map(({ id, label, mobileLabel, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => changeMode(id)}
              aria-current={mode === id ? 'page' : undefined}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                mode === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-white hover:text-blue-700'
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">{mobileLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mx-auto mt-6 max-w-2xl">
          {mode === 'LOGIN' && (
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-bold">Já criou sua senha?</p>
              <p className="mt-1 leading-relaxed">
                Informe o CPF do titular e a senha pessoal para entrar. O Portal do Associado é
                separado do painel administrativo da AAFAB.
              </p>
            </div>
          )}

          {mode === 'ACTIVATE' && (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <p className="font-bold">
                Seu cadastro já foi enviado, mas você ainda não tem senha?
              </p>
              <p className="mt-1 leading-relaxed">
                Solicite à Secretaria o código de ativação do portal. Ele vale por 24 horas e por um
                único uso. Com ele, você cria sua senha pessoal.
              </p>
            </div>
          )}

          {mode === 'REGISTER' && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">Ainda precisa realizar o cadastro inicial?</p>
              <p className="mt-1 leading-relaxed">
                Informe primeiro apenas o CPF. Se ele constar na relação da AAFAB e ainda precisar
                de liberação, serão mostrados o QR Code Pix e as orientações para enviar o
                comprovante à Secretaria.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="member-cpf"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                CPF do titular
              </label>
              <div className="relative">
                <input
                  id="member-cpf"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  value={cpf}
                  onChange={(e) => {
                    setCpf(formatCPF(e.target.value));
                    setError('');
                    if (mode === 'REGISTER') {
                      setRegistrationStatus('UNVERIFIED');
                      setAccessCode('');
                    }
                  }}
                  placeholder="000.000.000-00"
                  className={`${inputClass} pr-11 tracking-wider`}
                  required
                />
                <Search
                  aria-hidden="true"
                  className="absolute right-3 top-3.5 h-5 w-5 text-gray-400"
                />
              </div>
            </div>

            {mode === 'REGISTER' && registrationStatus === 'PAYMENT_REQUIRED' && (
              <BlockedCpfPixNotice />
            )}

            {mode === 'REGISTER' && registrationStatus === 'CODE_READY' && (
              <div
                role="status"
                className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900"
              >
                <p className="font-bold">CPF liberado pela Secretaria</p>
                <p className="mt-1 leading-relaxed">
                  Informe abaixo o código de liberação recebido para abrir o formulário de cadastro.
                </p>
              </div>
            )}

            {mode === 'REGISTER' && registrationStatus === 'ALREADY_REGISTERED' && (
              <div
                role="status"
                className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
              >
                <p className="font-bold">Este CPF já possui cadastro enviado</p>
                <p className="mt-1 leading-relaxed">
                  Use “Primeiro acesso” para criar sua senha com o código de ativação fornecido pela
                  Secretaria. Se a senha já foi criada, use “Entrar no portal”.
                </p>
              </div>
            )}

            {mode === 'REGISTER' && registrationStatus === 'CONTACT_SECRETARY' && (
              <div
                role="alert"
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
              >
                <p className="font-bold">Não foi possível liberar o cadastro automaticamente</p>
                <p className="mt-1 leading-relaxed">
                  Procure a Secretaria da AAFAB para confirmar sua situação. Nenhum dado cadastral
                  foi exibido nesta consulta.
                </p>
              </div>
            )}

            {(mode === 'ACTIVATE' ||
              (mode === 'REGISTER' && registrationStatus === 'CODE_READY')) && (
              <div>
                <label
                  htmlFor="member-code"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  {mode === 'ACTIVATE'
                    ? 'Código de ativação do portal'
                    : 'Código de liberação do cadastro'}
                </label>
                <input
                  id="member-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                    setError('');
                  }}
                  placeholder="00000000"
                  className={`${inputClass} tracking-[0.3em]`}
                  required
                />
              </div>
            )}

            {isPasswordMode && (
              <div>
                <label
                  htmlFor="member-password"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  {mode === 'ACTIVATE' ? 'Crie sua senha' : 'Senha'}
                </label>
                <div className="relative">
                  <input
                    id="member-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder={
                      mode === 'ACTIVATE' ? 'Mínimo de 10 caracteres' : 'Sua senha pessoal'
                    }
                    className={`${inputClass} pr-12`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2 top-1.5 flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {mode === 'ACTIVATE' && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Use pelo menos 10 caracteres, incluindo uma letra e um número.
                  </p>
                )}
              </div>
            )}

            {mode === 'ACTIVATE' && (
              <div>
                <label
                  htmlFor="member-confirmation"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Confirme sua senha
                </label>
                <input
                  id="member-confirmation"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => {
                    setConfirmation(e.target.value);
                    setError('');
                  }}
                  className={inputClass}
                  required
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <p className="text-sm font-medium leading-relaxed text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-13 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
                  {actionLabel}
                </>
              )}
            </button>
          </form>

          <div className="mt-7 border-t border-gray-100 pt-6">
            <div className="flex items-start gap-3 text-xs leading-relaxed text-gray-500">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Seus dados são usados apenas nos serviços da AAFAB, conforme as regras internas de
                privacidade e a LGPD. Nunca compartilhe sua senha ou seu código temporário.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
