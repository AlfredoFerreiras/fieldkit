import React, { createContext, useContext, useEffect, useState } from 'react';
import type * as SQLite from 'expo-sqlite';
import { getMeta, setMeta } from '../db';

export type Locale = 'en' | 'es';

const en = {
  'tabs.home': 'Home',
  'tabs.jobs': 'Jobs',
  'tabs.issues': 'Issues',
  'tabs.chat': 'Chat',
  'tabs.settings': 'Settings',

  'login.title': 'Who is signing in?',
  'login.subtitle': 'Pick your account and enter your PIN.',
  'login.pin': 'PIN',
  'login.wrongPin': 'That PIN is not right. Try again.',
  'login.signIn': 'Sign in',
  'login.newCustomer': 'New customer? Create an account',
  'login.createTitle': 'Create your account',
  'login.createSubtitle': 'For customers of {company}. Staff accounts are added by the office.',
  'login.name': 'Your name',
  'login.phone': 'Phone',
  'login.email': 'Email',
  'login.choosePin': 'Choose a 4-digit PIN',
  'login.confirmPin': 'Confirm PIN',
  'login.create': 'Create account',
  'login.back': 'Back to sign in',
  'login.nameRequired': 'Enter your name.',
  'login.pinLength': 'The PIN must be exactly 4 digits.',
  'login.pinMismatch': 'The PINs do not match.',

  'role.supervisor': 'Supervisor',
  'role.manager': 'Manager',
  'role.customer': 'Customer',

  'home.hello': 'Hello, {name}',
  'home.overview': 'Overview',
  'home.jobs': 'Job reports',
  'home.issues': 'Customer issues',
  'home.awaiting': '{n} awaiting verification',
  'home.allVerified': 'All issues verified',
  'home.startJob': 'Start job report',
  'home.reportIssue': 'Report a problem',
  'home.customerIntro':
    'Something not right after our crew visited? Tell us here and a manager will contact you.',
  'home.myIssues': 'My reports',

  'sync.sending': 'Sending…',
  'sync.allSent': 'Everything is with the office',
  'sync.pending': '{n} waiting to send. Tap to try now.',

  'status.draft': 'Not submitted',
  'status.queued': 'Waiting to send',
  'status.synced': 'Sent',
  'status.conflict': 'Needs your decision',

  'jobs.emptyTitle': 'No job reports yet',
  'jobs.emptyBody':
    'Start one now. It saves to this phone as you go, so you can finish it with no signal.',

  'job.gone': 'This job report is no longer on the phone.',
  'job.back': 'Back to the list',
  'job.readOnly': 'Submitted. Changes now would not reach the office, so this is read only.',
  'job.submit': 'Submit job report',
  'job.submittedTitle': 'Report submitted',
  'job.submittedBody':
    'It is saved on this phone and sends itself to the office as soon as you have signal.',

  'conflict.title': 'Someone else changed this job report',
  'conflict.body':
    'Your phone and the office have different answers. Pick which version to keep. Nothing is discarded until you choose.',
  'conflict.yours': 'Yours: {value}',
  'conflict.office': 'Office: {value}',
  'conflict.keepMine': 'Keep what I entered',
  'conflict.useOffice': 'Use the office version',
  'conflict.blank': 'blank',

  'common.yes': 'yes',
  'common.no': 'no',

  'form.required': 'Required',
  'form.needsAttention': '{n} fields need attention above.',
  'form.needsAttentionOne': '1 field needs attention above.',
  'form.footnote': 'Saved on this phone. It sends itself when you have signal.',
  'form.unsupported': 'Unsupported field type: {type}',
  'form.takePhoto': 'Take photo',
  'form.photoCount': 'Take photo ({n} of {max})',
  'form.remove': 'Remove',
  'form.typeTag': 'Type the tag number',

  'sig.signHere': 'Tap to sign',
  'sig.clear': 'Clear',
  'sig.done': 'Accept signature',
  'sig.cancel': 'Cancel',

  'issues.title': 'Customer issues',
  'issues.emptyTitle': 'No issues reported',
  'issues.emptyBody': 'When a customer reports a problem, it shows up here.',
  'issues.mineEmpty': 'You have not reported anything yet.',
  'issues.report': 'Report a problem',
  'issues.submittedTitle': 'Report received',
  'issues.submittedBody': 'A manager will look at it and contact you the way you asked.',
  'issues.call': 'Call',
  'issues.text': 'Text',
  'issues.email': 'Email',
  'issues.verify': 'Mark as verified',
  'issues.verified': 'Verified',
  'issues.verifiedBy': 'Verified by {name}',
  'issues.notVerified': 'Not verified yet',
  'issues.verifyHelp':
    'Call, text, or email the customer first. Verifying tells the office this issue is real and being handled.',
  'issues.gone': 'This issue is no longer on the phone.',

  'chat.title': 'Team chat',
  'chat.placeholder': 'Message the team…',
  'chat.send': 'Send',
  'chat.localNote': 'Messages stay on this phone for now. They will reach the team when the office server arrives.',
  'chat.empty': 'No messages yet. Say something to the team.',

  'settings.language': 'Language',
  'settings.team': 'Team',
  'settings.manageUsers': 'Manage users',
  'settings.signOut': 'Sign out',

  'users.title': 'Users',
  'users.add': 'Add user',
  'users.role': 'Role',
  'users.saved': 'User created. They can sign in with their PIN now.',
  'settings.signedInAs': 'Signed in as',
  'settings.pendingRows': '{n} report(s) waiting to send',
  'settings.nothingPending': 'Nothing waiting to send',

  'home.reports': 'Reports',
  'home.reportsHint': 'Sales, jobs, and team activity',
  'home.dashboard': 'Dashboard',
  'home.dashboardHint': 'Charts of everything at a glance',
  'home.attention': 'Needs attention',
  'home.allClear': 'All caught up. Nothing needs you right now.',
  'home.finishDraft': 'Finish this draft',
  'home.decideConflict': 'Needs your decision',
  'home.verifyIssues': '{n} issue(s) waiting for verification',
  'home.thisWeek': 'This week',
  'home.weekJobs': 'Jobs sent',
  'home.weekSales': 'Sales',
  'home.needHelp': 'Need to reach us?',
  'home.helpBody': 'Questions about your cleanup? The office answers directly.',
  'home.callOffice': 'Call the office',
  'home.textOffice': 'Text',
  'home.emailOffice': 'Email',

  'dashboard.title': 'Dashboard',
  'dashboard.jobsTile': 'Jobs submitted',
  'dashboard.issuesTile': 'Issues awaiting',
  'dashboard.jobsPerWeek': 'Jobs submitted per week',
  'dashboard.salesPerWeek': 'Sales per week',
  'dashboard.last8': 'Last 8 weeks',
  'dashboard.status': 'Job report status',
  'dashboard.smoke': 'Smoke damage on submitted jobs',
  'dashboard.areas': 'Most affected areas',
  'dashboard.weekOf': 'Week of {date}',

  'reports.title': 'Reports',
  'reports.last7': 'Last 7 days',
  'reports.last30': 'Last 30 days',
  'reports.all': 'All time',
  'reports.sales': 'Sales',
  'reports.salesTotal': 'Total value',
  'reports.salesPaid': 'Paid',
  'reports.salesOutstanding': 'Outstanding',
  'reports.salesAvg': 'Average per job',
  'reports.salesNote':
    'Counts submitted job reports with a value in the Billing section. Drafts are not counted.',
  'reports.jobs': 'Jobs',
  'reports.jobsStarted': 'Started',
  'reports.jobsSubmitted': 'Submitted',
  'reports.boxesPacked': 'Boxes packed',
  'reports.crew': 'By crew lead',
  'reports.crewJobs': '{n} job(s)',
  'reports.issues': 'Customer issues',
  'reports.issuesReported': 'Reported',
  'reports.issuesVerified': 'Verified',
  'reports.issuesAwaiting': 'Awaiting',
  'reports.team': 'Team',
  'reports.messages': 'Chat messages sent',
  'reports.share': 'Share this report',
  'reports.empty': 'Nothing recorded in this period yet.',

  'time.justNow': 'just now',
  'time.minutes': '{n}m ago',
  'time.hours': '{n}h ago',
  'time.days': '{n}d ago',
} as const;

export type MessageKey = keyof typeof en;

const es: Record<MessageKey, string> = {
  'tabs.home': 'Inicio',
  'tabs.jobs': 'Trabajos',
  'tabs.issues': 'Problemas',
  'tabs.chat': 'Chat',
  'tabs.settings': 'Ajustes',

  'login.title': '¿Quién entra?',
  'login.subtitle': 'Elija su cuenta y escriba su PIN.',
  'login.pin': 'PIN',
  'login.wrongPin': 'Ese PIN no es correcto. Intente de nuevo.',
  'login.signIn': 'Entrar',
  'login.newCustomer': '¿Cliente nuevo? Cree una cuenta',
  'login.createTitle': 'Cree su cuenta',
  'login.createSubtitle': 'Para clientes de {company}. Las cuentas del personal las crea la oficina.',
  'login.name': 'Su nombre',
  'login.phone': 'Teléfono',
  'login.email': 'Correo',
  'login.choosePin': 'Elija un PIN de 4 dígitos',
  'login.confirmPin': 'Confirme el PIN',
  'login.create': 'Crear cuenta',
  'login.back': 'Volver a entrar',
  'login.nameRequired': 'Escriba su nombre.',
  'login.pinLength': 'El PIN debe tener exactamente 4 dígitos.',
  'login.pinMismatch': 'Los PIN no coinciden.',

  'role.supervisor': 'Supervisor',
  'role.manager': 'Encargado',
  'role.customer': 'Cliente',

  'home.hello': 'Hola, {name}',
  'home.overview': 'Resumen',
  'home.jobs': 'Reportes de trabajo',
  'home.issues': 'Problemas de clientes',
  'home.awaiting': '{n} por verificar',
  'home.allVerified': 'Todos los problemas verificados',
  'home.startJob': 'Nuevo reporte de trabajo',
  'home.reportIssue': 'Reportar un problema',
  'home.customerIntro':
    '¿Algo no quedó bien después de la visita de nuestro equipo? Cuéntenos aquí y un encargado le contactará.',
  'home.myIssues': 'Mis reportes',

  'sync.sending': 'Enviando…',
  'sync.allSent': 'Todo está con la oficina',
  'sync.pending': '{n} por enviar. Toque para intentar ahora.',

  'status.draft': 'Sin enviar',
  'status.queued': 'Esperando señal',
  'status.synced': 'Enviado',
  'status.conflict': 'Necesita su decisión',

  'jobs.emptyTitle': 'Aún no hay reportes',
  'jobs.emptyBody':
    'Empiece uno ahora. Se guarda en este teléfono mientras escribe, así puede terminarlo sin señal.',

  'job.gone': 'Este reporte ya no está en el teléfono.',
  'job.back': 'Volver a la lista',
  'job.readOnly': 'Enviado. Los cambios ya no llegarían a la oficina, así que es solo lectura.',
  'job.submit': 'Enviar reporte',
  'job.submittedTitle': 'Reporte enviado',
  'job.submittedBody':
    'Está guardado en este teléfono y se envía solo a la oficina en cuanto haya señal.',

  'conflict.title': 'Alguien más cambió este reporte',
  'conflict.body':
    'Su teléfono y la oficina tienen respuestas distintas. Elija cuál versión conservar. Nada se borra hasta que elija.',
  'conflict.yours': 'Suyo: {value}',
  'conflict.office': 'Oficina: {value}',
  'conflict.keepMine': 'Conservar lo mío',
  'conflict.useOffice': 'Usar la versión de la oficina',
  'conflict.blank': 'vacío',

  'common.yes': 'sí',
  'common.no': 'no',

  'form.required': 'Obligatorio',
  'form.needsAttention': '{n} campos necesitan atención arriba.',
  'form.needsAttentionOne': '1 campo necesita atención arriba.',
  'form.footnote': 'Guardado en este teléfono. Se envía solo cuando haya señal.',
  'form.unsupported': 'Tipo de campo no soportado: {type}',
  'form.takePhoto': 'Tomar foto',
  'form.photoCount': 'Tomar foto ({n} de {max})',
  'form.remove': 'Quitar',
  'form.typeTag': 'Escriba el número de etiqueta',

  'sig.signHere': 'Toque para firmar',
  'sig.clear': 'Borrar',
  'sig.done': 'Aceptar firma',
  'sig.cancel': 'Cancelar',

  'issues.title': 'Problemas de clientes',
  'issues.emptyTitle': 'No hay problemas reportados',
  'issues.emptyBody': 'Cuando un cliente reporte un problema, aparecerá aquí.',
  'issues.mineEmpty': 'Aún no ha reportado nada.',
  'issues.report': 'Reportar un problema',
  'issues.submittedTitle': 'Reporte recibido',
  'issues.submittedBody': 'Un encargado lo revisará y le contactará como usted pidió.',
  'issues.call': 'Llamar',
  'issues.text': 'Mensaje',
  'issues.email': 'Correo',
  'issues.verify': 'Marcar como verificado',
  'issues.verified': 'Verificado',
  'issues.verifiedBy': 'Verificado por {name}',
  'issues.notVerified': 'Aún sin verificar',
  'issues.verifyHelp':
    'Llame, mande mensaje o escriba al cliente primero. Verificar avisa a la oficina que el problema es real y se está atendiendo.',
  'issues.gone': 'Este problema ya no está en el teléfono.',

  'chat.title': 'Chat del equipo',
  'chat.placeholder': 'Mensaje al equipo…',
  'chat.send': 'Enviar',
  'chat.localNote':
    'Por ahora los mensajes se quedan en este teléfono. Llegarán al equipo cuando esté el servidor de la oficina.',
  'chat.empty': 'No hay mensajes. Diga algo al equipo.',

  'settings.language': 'Idioma',
  'settings.team': 'Equipo',
  'settings.manageUsers': 'Administrar usuarios',
  'settings.signOut': 'Salir',

  'users.title': 'Usuarios',
  'users.add': 'Agregar usuario',
  'users.role': 'Rol',
  'users.saved': 'Usuario creado. Ya puede entrar con su PIN.',
  'settings.signedInAs': 'Sesión de',
  'settings.pendingRows': '{n} reporte(s) por enviar',
  'settings.nothingPending': 'Nada por enviar',

  'home.reports': 'Reportes',
  'home.reportsHint': 'Ventas, trabajos y actividad del equipo',
  'home.dashboard': 'Panel',
  'home.dashboardHint': 'Gráficas de todo de un vistazo',
  'home.attention': 'Requiere atención',
  'home.allClear': 'Todo al día. Nada le necesita ahora.',
  'home.finishDraft': 'Terminar este borrador',
  'home.decideConflict': 'Necesita su decisión',
  'home.verifyIssues': '{n} problema(s) por verificar',
  'home.thisWeek': 'Esta semana',
  'home.weekJobs': 'Trabajos enviados',
  'home.weekSales': 'Ventas',
  'home.needHelp': '¿Necesita contactarnos?',
  'home.helpBody': '¿Preguntas sobre su limpieza? La oficina le atiende directo.',
  'home.callOffice': 'Llamar a la oficina',
  'home.textOffice': 'Mensaje',
  'home.emailOffice': 'Correo',

  'dashboard.title': 'Panel',
  'dashboard.jobsTile': 'Trabajos enviados',
  'dashboard.issuesTile': 'Problemas pendientes',
  'dashboard.jobsPerWeek': 'Trabajos enviados por semana',
  'dashboard.salesPerWeek': 'Ventas por semana',
  'dashboard.last8': 'Últimas 8 semanas',
  'dashboard.status': 'Estado de los reportes',
  'dashboard.smoke': 'Daño por humo en trabajos enviados',
  'dashboard.areas': 'Áreas más afectadas',
  'dashboard.weekOf': 'Semana del {date}',

  'reports.title': 'Reportes',
  'reports.last7': 'Últimos 7 días',
  'reports.last30': 'Últimos 30 días',
  'reports.all': 'Todo',
  'reports.sales': 'Ventas',
  'reports.salesTotal': 'Valor total',
  'reports.salesPaid': 'Pagado',
  'reports.salesOutstanding': 'Por cobrar',
  'reports.salesAvg': 'Promedio por trabajo',
  'reports.salesNote':
    'Cuenta reportes de trabajo enviados con valor en la sección de Facturación. Los borradores no cuentan.',
  'reports.jobs': 'Trabajos',
  'reports.jobsStarted': 'Iniciados',
  'reports.jobsSubmitted': 'Enviados',
  'reports.boxesPacked': 'Cajas empacadas',
  'reports.crew': 'Por jefe de equipo',
  'reports.crewJobs': '{n} trabajo(s)',
  'reports.issues': 'Problemas de clientes',
  'reports.issuesReported': 'Reportados',
  'reports.issuesVerified': 'Verificados',
  'reports.issuesAwaiting': 'Pendientes',
  'reports.team': 'Equipo',
  'reports.messages': 'Mensajes de chat enviados',
  'reports.share': 'Compartir este reporte',
  'reports.empty': 'Aún no hay nada registrado en este periodo.',

  'time.justNow': 'ahora mismo',
  'time.minutes': 'hace {n}m',
  'time.hours': 'hace {n}h',
  'time.days': 'hace {n}d',
};

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, es };

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside LocaleProvider');
  return ctx;
}

const LOCALE_KEY = 'locale';

export function LocaleProvider({
  db,
  children,
}: {
  db: SQLite.SQLiteDatabase;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    void getMeta(db, LOCALE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'es') setLocaleState(stored);
    });
  }, [db]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    void setMeta(db, LOCALE_KEY, next);
  }

  const t: Translate = (key, params) => {
    let message: string = dictionaries[locale][key];
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        message = message.replace(`{${name}}`, String(value));
      }
    }
    return message;
  };

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}
