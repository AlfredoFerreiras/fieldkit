import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDb } from '../../src/db/context';
import { useAuth } from '../../src/auth/session';
import { useI18n } from '../../src/i18n';
import { relativeTime } from '../../src/i18n/relativeTime';
import { listMessages, sendMessage, type ChatMessage } from '../../src/db/messages';
import { useBadges } from '../../src/notifications/badges';
import { color, radius, shadow, space, TOUCH, type } from '../../src/components/theme';

export default function Chat() {
  const { db } = useDb();
  const { user } = useAuth();
  const { t } = useI18n();
  const { markChatRead } = useBadges();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  const reload = useCallback(() => {
    void listMessages(db).then(setMessages);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
      void markChatRead();
      // Leaving the screen also counts as having read what was on it.
      return () => void markChatRead();
    }, [reload, markChatRead]),
  );

  async function handleSend() {
    const body = draft.trim();
    if (!body || !user) return;
    setDraft('');
    await sendMessage(db, { id: user.id, name: user.name, role: user.role }, body);
    reload();
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <View style={styles.note}>
        <Text style={styles.noteText}>{t('chat.localNote')}</Text>
      </View>

      <FlatList
        style={styles.flex}
        data={messages}
        inverted
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyFlip}>
            <Text style={styles.empty}>{t('chat.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const mine = item.authorId === user?.id;
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                {!mine ? <Text style={styles.author}>{item.author}</Text> : null}
                <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {relativeTime(t, item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={color.inkFaint}
          multiline
        />
        <Pressable
          style={[styles.send, draft.trim() === '' && styles.sendDisabled]}
          onPress={handleSend}
          disabled={draft.trim() === ''}
        >
          <Text style={styles.sendText}>{t('chat.send')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.canvas },

  note: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  noteText: { ...type.meta, color: color.inkFaint },

  list: { padding: space.lg, gap: space.sm },
  emptyFlip: { transform: [{ scaleY: -1 }], padding: space.xl },
  empty: { ...type.body, color: color.inkMuted, textAlign: 'center' },

  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: 2,
    ...shadow.card,
  },
  bubbleOther: { backgroundColor: color.surface },
  bubbleMine: { backgroundColor: color.brand },
  author: { ...type.meta, color: color.brand },
  body: { ...type.body, color: color.ink },
  bodyMine: { color: color.surface },
  time: { ...type.meta, fontSize: 11, color: color.inkFaint },
  timeMine: { color: color.brandTint },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.surface,
  },
  input: {
    ...type.body,
    flex: 1,
    minHeight: TOUCH - 12,
    maxHeight: 120,
    borderWidth: 1.5,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: color.ink,
    backgroundColor: color.canvas,
  },
  send: {
    minHeight: TOUCH - 12,
    borderRadius: radius.md,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  sendDisabled: { backgroundColor: color.inkFaint },
  sendText: { ...type.label, color: color.surface },
});
