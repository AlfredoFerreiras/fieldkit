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
  'login.subtitle': 'Demo accounts. Real accounts arrive with the office server.',
  'login.pin': 'PIN',
  'login.wrongPin': 'That PIN is not right. Try again.',
  'login.signIn': 'Sign in',

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
  'settings.signOut': 'Sign out',
  'settings.signedInAs': 'Signed in as',
  'settings.pendingRows': '{n} report(s) waiting to send',
  'settings.nothingPending': 'Nothing waiting to send',

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
  'login.subtitle': 'Cuentas de demostración. Las cuentas reales llegan con el servidor de la oficina.',
  'login.pin': 'PIN',
  'login.wrongPin': 'Ese PIN no es correcto. Intente de nuevo.',
  'login.signIn': 'Entrar',

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
  'settings.signOut': 'Salir',
  'settings.signedInAs': 'Sesión de',
  'settings.pendingRows': '{n} reporte(s) por enviar',
  'settings.nothingPending': 'Nada por enviar',

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
