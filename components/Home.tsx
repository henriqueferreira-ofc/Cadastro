import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Clock,
  FileText,
  HeartHandshake,
  Lock,
  Mail,
  Menu,
  MessageSquareText,
  Newspaper,
  Scale,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import logo from '../logo.png';

interface HomeProps {
  onOpenPortal: () => void;
  onRegister: () => void;
  onActivate: () => void;
  onAdmin: () => void;
}

const CONTACT_EMAIL = 'aafab.secretaria@gmail.com';

const pillars = [
  {
    icon: Scale,
    title: 'Defesa de direitos',
    text: 'Acompanhamento e medidas em favor dos interesses coletivos dos associados.',
  },
  {
    icon: Newspaper,
    title: 'Informação e transparência',
    text: 'Comunicados e o andamento das ações publicados diretamente no Portal do Associado.',
  },
  {
    icon: HeartHandshake,
    title: 'Atendimento próximo',
    text: 'Secretaria e Financeiro para esclarecer dúvidas, receber solicitações e apoiar o associado.',
  },
];

const portalFeatures = [
  {
    icon: Newspaper,
    title: 'Trabalhos e comunicados',
    text: 'Acompanhe o que a AAFAB vem realizando e leia os documentos publicados.',
  },
  {
    icon: MessageSquareText,
    title: 'Secretaria',
    text: 'Envie solicitações, converse com a Secretaria e peça isenção com laudo ou documento.',
  },
  {
    icon: Wallet,
    title: 'Meu financeiro',
    text: 'Veja as mensalidades do ano, pague via Pix e envie o comprovante.',
  },
  {
    icon: UserRound,
    title: 'Meus dados',
    text: 'Consulte as informações do seu cadastro sempre que precisar.',
  },
];

const steps = [
  {
    title: 'Realize o cadastro',
    text: 'Confirme o seu CPF e preencha os dados do titular.',
  },
  {
    title: 'Receba o código de ativação',
    text: 'A Secretaria entrega o código pessoal, válido por 24 horas e de uso único.',
  },
  {
    title: 'Crie sua senha e acesse',
    text: 'Com o código, você cria a sua senha e passa a entrar direto no portal.',
  },
];

const navLinks = [
  { href: '#sobre', label: 'Sobre' },
  { href: '#portal', label: 'Portal' },
  { href: '#como-participar', label: 'Como participar' },
  { href: '#contato', label: 'Contato' },
];

// Aparece suavemente quando entra na tela. Sem animação para quem prefere movimento reduzido.
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const Home: React.FC<HomeProps> = ({ onOpenPortal, onRegister, onActivate, onAdmin }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-white text-slate-800 antialiased">
      <header
        className={`sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur transition-shadow duration-300 ${scrolled ? 'shadow-md shadow-blue-950/5' : ''}`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#inicio" className="flex min-w-0 items-center gap-3" aria-label="AAFAB — início">
            <img src={logo} alt="" className="h-10 w-10 shrink-0 sm:h-11 sm:w-11" />
            <span className="min-w-0 leading-tight">
              <span className="block text-base font-bold tracking-tight text-blue-950">AAFAB</span>
              <span className="hidden text-[11px] font-medium text-slate-500 lg:block">
                Associação Amigos da Força Aérea Brasileira
              </span>
            </span>
          </a>
          <nav aria-label="Principal" className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-blue-900"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenPortal}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-blue-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:px-5"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span className="sm:hidden">Portal</span>
              <span className="hidden sm:inline">Portal do Associado</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="menu-mobile"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 lg:hidden"
            >
              {menuOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="menu-mobile"
            aria-label="Menu"
            className="home-rise border-t border-slate-100 bg-white px-4 pb-4 pt-2 lg:hidden"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-12 items-center border-b border-slate-100 text-base font-medium text-slate-700 last:border-0"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}
        <div
          aria-hidden="true"
          className="h-[3px] bg-gradient-to-r from-green-600 via-amber-400 to-blue-700"
        />
      </header>

      <main>
        {/* Início */}
        <section
          id="inicio"
          className="relative isolate overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 text-white"
        >
          <div
            aria-hidden="true"
            className="blob-drift absolute -left-24 top-10 -z-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="blob-drift-reverse absolute -bottom-24 right-0 -z-10 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:py-24">
            <div
              className="home-rise order-first flex justify-center lg:order-last lg:justify-end"
              style={{ animationDelay: '80ms' }}
            >
              <div className="relative my-8 sm:my-10 lg:my-0">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    aria-hidden="true"
                    className="logo-ripple absolute inset-0 rounded-full border border-white/40"
                    style={{ animationDelay: `${index * 1.4}s` }}
                  />
                ))}
                <div
                  aria-hidden="true"
                  className="logo-orbit absolute -inset-5 rounded-full border border-dashed border-white/25 sm:-inset-6"
                >
                  <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_14px_3px_rgba(252,211,77,0.55)]" />
                </div>
                <div
                  aria-hidden="true"
                  className="logo-orbit-reverse absolute -inset-9 rounded-full border border-white/10 sm:-inset-11"
                >
                  <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full bg-green-400 shadow-[0_0_12px_3px_rgba(74,222,128,0.45)]" />
                </div>
                <div className="logo-float relative flex h-44 w-44 items-center justify-center rounded-full bg-white shadow-2xl shadow-blue-950/40 sm:h-64 sm:w-64 lg:h-80 lg:w-80">
                  <img
                    src={logo}
                    alt="Logotipo da AAFAB — Associação Amigos da Força Aérea Brasileira"
                    className="h-40 w-40 sm:h-56 sm:w-56 lg:h-72 lg:w-72"
                  />
                </div>
              </div>
            </div>
            <div className="home-rise text-center lg:text-left">
              <p className="pill-live relative inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-blue-100 sm:text-xs">
                <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                  <span className="dot-ping absolute inset-0 rounded-full bg-green-400" />
                  <span className="dot-blink relative h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.7)]" />
                </span>
                <span className="relative truncate">
                  Associação Amigos da Força Aérea Brasileira
                </span>
              </p>
              <h1 className="mt-5 text-balance text-3xl font-bold leading-[1.15] tracking-tight sm:mt-6 sm:text-5xl lg:text-6xl lg:leading-[1.1]">
                União, representatividade e apoio ao associado.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-blue-100 sm:mt-6 sm:text-lg lg:mx-0">
                A AAFAB atua em favor dos seus associados, com transparência, informação e
                atendimento próximo, do cadastro ao acompanhamento de tudo pelo portal.
              </p>
              <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:mt-9 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start">
                <button
                  type="button"
                  onClick={onOpenPortal}
                  className="group/btn inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-blue-950 shadow-lg shadow-blue-950/20 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                >
                  Acessar o Portal do Associado
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onClick={onRegister}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-7 text-base font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
                >
                  Realizar cadastro
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Sobre */}
        <section id="sobre" className="scroll-mt-20 bg-white py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
                Sobre a AAFAB
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-blue-950 sm:text-4xl">
                Uma associação feita de pessoas, com compromisso e clareza.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                Trabalhamos para que cada associado saiba o que está sendo feito, tenha a quem
                recorrer e possa acompanhar a sua situação com facilidade e segurança.
              </p>
            </Reveal>
            <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-3">
              {pillars.map(({ icon: Icon, title, text }, index) => (
                <Reveal key={title} delay={index * 120} className="h-full">
                  <article className="card-live group relative flex h-full gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 lg:block lg:p-7">
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-green-500 via-amber-400 to-blue-600 transition-transform duration-500 group-hover:scale-x-100"
                    />
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800 transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 group-hover:bg-blue-900 group-hover:text-white lg:h-12 lg:w-12">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-blue-950 lg:mt-5 lg:text-lg">
                        {title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600 lg:mt-2 lg:text-base">
                        {text}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Portal */}
        <section id="portal" className="scroll-mt-20 bg-slate-50 py-14 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
                Portal do Associado
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-blue-950 sm:text-4xl">
                Tudo em um só lugar, com acesso individual e seguro.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                Entre com o seu CPF e a sua senha pessoal para acompanhar comunicados, atendimentos,
                mensalidades e dados cadastrais.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onOpenPortal}
                  className="group/btn inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-blue-900 px-7 text-base font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                >
                  Entrar no portal
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onClick={onActivate}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-7 text-base font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                >
                  Primeiro acesso
                </button>
              </div>
              <p className="mt-6 flex items-start gap-2 text-sm text-slate-500">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Cada associado vê somente os seus próprios dados.
              </p>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              {portalFeatures.map(({ icon: Icon, title, text }, index) => (
                <Reveal key={title} delay={index * 110} className="h-full">
                  <article className="card-live group relative flex h-full gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:block sm:p-6">
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-amber-400 to-amber-500 transition-transform duration-500 group-hover:scale-x-100"
                    />
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-blue-950 sm:mt-4">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:mt-1.5">
                        {text}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Como participar */}
        <section id="como-participar" className="scroll-mt-20 bg-white py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
                Como participar
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-blue-950 sm:text-4xl">
                Três passos simples para começar.
              </h2>
            </Reveal>
            <ol className="mt-10 grid gap-4 sm:mt-12 lg:grid-cols-3 lg:gap-6">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <Reveal delay={index * 140} className="h-full">
                    <div className="card-live group relative flex h-full gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:block lg:p-7">
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-900 text-base font-bold text-white transition duration-300 group-hover:scale-110">
                        <span
                          aria-hidden="true"
                          className="step-ping absolute inset-0 rounded-full bg-blue-700/50"
                          style={{ animationDelay: `${index * 0.9}s` }}
                        />
                        <span className="relative">{index + 1}</span>
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-blue-950 lg:mt-5 lg:text-lg">
                          {step.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-600 lg:mt-2 lg:text-base">
                          {step.text}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
            <div className="mx-auto mt-8 flex max-w-sm justify-center sm:mt-10 sm:max-w-none">
              <button
                type="button"
                onClick={onRegister}
                className="group/btn inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-900 px-8 text-base sm:w-auto font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                Começar meu cadastro
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </section>

        {/* Contato */}
        <section id="contato" className="scroll-mt-20 bg-blue-950 py-14 text-white sm:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-7 px-4 text-center sm:px-6 md:grid-cols-[1.2fr_0.8fr] md:gap-8 md:text-left">
            <Reveal>
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
                Precisa falar com a Secretaria?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-blue-100 sm:text-lg md:mx-0">
                Dúvidas sobre cadastro, código de ativação ou mensalidades? Escreva para nós. Depois
                do primeiro acesso, o atendimento também pode ser feito dentro do portal.
              </p>
            </Reveal>
            <Reveal delay={150} className="space-y-3 md:justify-self-end">
              <div className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-left">
                <p className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Clock className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                  Horário de funcionamento da Secretaria
                </p>
                <ul className="mt-2 space-y-0.5 pl-6 text-sm text-blue-100">
                  <li>Das 09:00 às 12:00</li>
                  <li>Das 14:00 às 18:00</li>
                </ul>
              </div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-white/25 bg-white/10 px-6 py-2 text-sm font-semibold text-white transition hover:bg-white/20 sm:w-auto sm:text-base focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
              >
                <Mail
                  className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110"
                  aria-hidden="true"
                />
                <span className="break-all">{CONTACT_EMAIL}</span>
              </a>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-1.5 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 text-center text-[11px] leading-snug text-slate-500 sm:flex-row sm:justify-between sm:gap-4 sm:px-6 sm:py-8 sm:text-left sm:text-xs">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="hidden h-9 w-9 sm:block" />
            <p className="sm:leading-relaxed">
              &copy; 2026 AAFAB — Associação Amigos da Força Aérea Brasileira
              <span className="block">Dados tratados em conformidade com a LGPD.</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onAdmin}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Área administrativa
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Home;
