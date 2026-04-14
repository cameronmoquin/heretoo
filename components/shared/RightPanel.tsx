import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/design';
import { usePanelStore, type PanelMode } from '../../stores/panelStore';
import { useWallet, useSpendInvite } from '../../hooks/useWallet';
import { formatWamp, WAMP } from '../../constants/wamp';
import { showAlert } from '../../lib/alert';

const TABS: { mode: PanelMode; icon: string; label: string }[] = [
  { mode: 'wallet', icon: 'wallet-outline', label: 'WAMP' },
  { mode: 'events', icon: 'calendar-outline', label: 'Events' },
  { mode: 'chat', icon: 'chatbubble-outline', label: 'Chat' },
  { mode: 'dm', icon: 'mail-outline', label: 'DM' },
  { mode: 'art', icon: 'image-outline', label: 'Art' },
  { mode: 'research', icon: 'search-outline', label: 'Research' },
];

const ARTWORKS = [
  { id: 1, url: 'https://picsum.photos/seed/art1/400/500', title: 'Untitled I' },
  { id: 2, url: 'https://picsum.photos/seed/art2/400/500', title: 'Untitled II' },
  { id: 3, url: 'https://picsum.photos/seed/art3/400/500', title: 'Untitled III' },
  { id: 4, url: 'https://picsum.photos/seed/art4/400/500', title: 'Untitled IV' },
];

function ArtPanel() {
  const [artIndex, setArtIndex] = useState(0);
  const art = ARTWORKS[artIndex % ARTWORKS.length];
  return (
    <View style={styles.artPanel}>
      <Image source={{ uri: art.url }} style={styles.artImage} resizeMode="cover" />
      <View style={styles.artFooter}>
        <Text style={styles.artTitle}>{art.title}</Text>
        <TouchableOpacity onPress={() => setArtIndex((i) => i + 1)}>
          <Ionicons name="shuffle-outline" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ChatPanel() {
  const { chatMessages, addChatMessage } = usePanelStore();
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim()) return;
    addChatMessage({ author: 'You', text: text.trim() });
    setText('');
  };

  return (
    <View style={styles.chatPanel}>
      <Text style={styles.panelTitle}>Live Chat</Text>
      <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
        {chatMessages.map((msg) => (
          <View key={msg.id} style={styles.chatMsg}>
            <Text style={styles.chatAuthor}>{msg.author}</Text>
            <Text style={styles.chatText}>{msg.text}</Text>
            <Text style={styles.chatTime}>{msg.time}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          value={text}
          onChangeText={setText}
          placeholder="Say something..."
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <TouchableOpacity onPress={send} style={styles.chatSendBtn}>
          <Ionicons name="arrow-up" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DMPanel() {
  const contacts = [
    { name: 'Sandy Corvo', last: 'The knife thing was a metaphor.', time: '3h' },
    { name: 'Vega', last: 'I found something in the case file.', time: '5h' },
    { name: 'Dillon Marsh', last: 'The alpacas are confirmed for Saturday.', time: '1d' },
    { name: 'Jude', last: 'Pip says hello. He does not but I am being polite.', time: '2d' },
  ];
  return (
    <View style={styles.dmPanel}>
      <Text style={styles.panelTitle}>Messages</Text>
      {contacts.map((c, i) => (
        <TouchableOpacity key={i} style={styles.dmItem}>
          <View style={styles.dmAvatar}>
            <Text style={styles.dmInitial}>{c.name[0]}</Text>
          </View>
          <View style={styles.dmContent}>
            <View style={styles.dmHeader}>
              <Text style={styles.dmName}>{c.name}</Text>
              <Text style={styles.dmTime}>{c.time}</Text>
            </View>
            <Text style={styles.dmLast} numberOfLines={1}>{c.last}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ResearchPanel() {
  const { researchQuery, setResearchQuery } = usePanelStore();
  const [results, setResults] = useState<string[]>([]);

  const search = () => {
    if (!researchQuery.trim()) return;
    setResults([
      'Wampum was used as a record of agreements between nations, not as currency. The colonial conversion to money happened in the 1600s.',
      'Federal Hill, Providence: historically Italian-American neighborhood. Triple-decker houses built 1890-1930.',
      'The Alsos Mission (1943-1945) was a secret US military effort to assess Axis nuclear research, led by Boris Pash with Samuel Goudsmit as scientific lead.',
    ]);
  };

  return (
    <View style={styles.researchPanel}>
      <Text style={styles.panelTitle}>Research</Text>
      <Text style={styles.researchSub}>Fact-check. Dig deeper.</Text>
      <View style={styles.researchInputRow}>
        <TextInput
          style={styles.researchInput}
          value={researchQuery}
          onChangeText={setResearchQuery}
          placeholder="Look something up..."
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={search} style={styles.researchBtn}>
          <Ionicons name="search" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.researchResults}>
        {results.map((r, i) => (
          <View key={i} style={styles.resultCard}>
            <Text style={styles.resultText}>{r}</Text>
          </View>
        ))}
        {results.length === 0 && (
          <Text style={styles.researchEmpty}>Search for a topic, name, or claim.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function WalletPanel() {
  const { wallet, transactions } = useWallet();
  const spendInvite = useSpendInvite();
  const canInvite = wallet.balance >= WAMP.INVITE_COST;

  const txLabels: Record<string, string> = {
    earn_vote: 'Voted',
    earn_bridge: 'Bridge',
    earn_post_bridging: 'Post bridged',
    earn_comment: 'Comment',
    earn_daily_login: 'Logged in',
    earn_invite_accepted: 'Invite accepted',
    spend_invite: 'Invite sent',
    transfer_out: 'Sent',
    transfer_in: 'Received',
    bonus: 'Bonus',
    genesis: 'Welcome',
  };

  const handleInvite = () => {
    if (!canInvite) {
      showAlert('Not enough WAMP', `You need ${formatWamp(WAMP.INVITE_COST)} to invite. Keep participating.`);
      return;
    }
    spendInvite.mutate(undefined, {
      onSuccess: (data) => {
        showAlert('Invite code', data.code);
      },
    });
  };

  return (
    <View style={styles.walletPanel}>
      {/* Balance */}
      <View style={styles.walletBalance}>
        <Text style={styles.walletLabel}>WAMP</Text>
        <Text style={styles.walletAmount}>{wallet.balance.toFixed(2)}</Text>
        <Text style={styles.walletSub}>Earned {wallet.lifetime_earned.toFixed(2)} total</Text>
      </View>

      {/* Invite button */}
      <TouchableOpacity
        style={[styles.walletInviteBtn, !canInvite && styles.walletInviteBtnDisabled]}
        onPress={handleInvite}
        activeOpacity={0.7}
      >
        <Ionicons name="person-add-outline" size={16} color={canInvite ? '#FFF' : Colors.textMuted} />
        <Text style={[styles.walletInviteText, !canInvite && { color: Colors.textMuted }]}>
          Invite ({formatWamp(WAMP.INVITE_COST)})
        </Text>
      </TouchableOpacity>

      {/* How to earn */}
      <View style={styles.walletEarnSection}>
        <Text style={styles.walletEarnTitle}>How to earn</Text>
        <View style={styles.walletEarnRow}><Text style={styles.walletEarnLabel}>Vote on Pulse</Text><Text style={styles.walletEarnAmt}>+{WAMP.EARN_VOTE} W</Text></View>
        <View style={styles.walletEarnRow}><Text style={styles.walletEarnLabel}>Complete a Bridge</Text><Text style={styles.walletEarnAmt}>+{WAMP.EARN_BRIDGE_COMPLETE} W</Text></View>
        <View style={styles.walletEarnRow}><Text style={styles.walletEarnLabel}>Post bridges 3+ groups</Text><Text style={styles.walletEarnAmt}>+{WAMP.EARN_POST_BRIDGING} W</Text></View>
        <View style={styles.walletEarnRow}><Text style={styles.walletEarnLabel}>Daily login</Text><Text style={styles.walletEarnAmt}>+{WAMP.EARN_DAILY_LOGIN} W</Text></View>
        <View style={styles.walletEarnRow}><Text style={styles.walletEarnLabel}>Invite accepted</Text><Text style={styles.walletEarnAmt}>+{WAMP.EARN_INVITE_ACCEPTED} W</Text></View>
      </View>

      {/* Recent transactions */}
      <ScrollView style={styles.walletTxList}>
        <Text style={styles.walletTxTitle}>Recent</Text>
        {transactions.slice(0, 10).map((tx) => (
          <View key={tx.id} style={styles.walletTxRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletTxLabel}>{txLabels[tx.type] ?? tx.type}</Text>
              {tx.note && <Text style={styles.walletTxNote}>{tx.note}</Text>}
            </View>
            <Text style={[styles.walletTxAmt, tx.amount > 0 ? { color: Colors.agree } : { color: Colors.disagree }]}>
              {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function EventsPanel() {
  const events = [
    { id: 1, title: 'Community Potluck', where: 'Federal Hill', when: 'Sat Apr 18 · 5pm', going: 34 },
    { id: 2, title: 'Open Mic Night', where: 'Seven Petals', when: 'Thu Apr 17 · 7pm', going: 22 },
    { id: 3, title: 'Bridge Walk', where: 'India Point Park', when: 'Sun Apr 19 · 10am', going: 18 },
    { id: 4, title: 'Maker Market', where: 'Westminster St', when: 'Sat Apr 25 · 9am', going: 67 },
    { id: 5, title: 'Neighborhood Cleanup', where: 'Atwells Ave', when: 'Sun Apr 26 · 8am', going: 12 },
  ];
  return (
    <View style={styles.eventsPanel}>
      <Text style={styles.panelTitle}>Events</Text>
      <ScrollView contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingBottom: 20 }}>
        {events.map((e) => (
          <TouchableOpacity key={e.id} style={styles.eventCard}>
            <View style={styles.eventDate}>
              <Text style={styles.eventDateText}>{e.when.split(' · ')[0].split(' ').slice(1).join(' ')}</Text>
            </View>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{e.title}</Text>
              <Text style={styles.eventMeta}>{e.where} · {e.when.split(' · ')[1]}</Text>
              <Text style={styles.eventGoing}>{e.going} going</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export function RightPanel() {
  const { mode, setMode } = usePanelStore();

  return (
    <View style={styles.container}>
      {/* Mode tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = mode === tab.mode;
          return (
            <TouchableOpacity
              key={tab.mode}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setMode(tab.mode)}
            >
              <Ionicons name={tab.icon as any} size={16} color={active ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {mode === 'wallet' && <WalletPanel />}
        {mode === 'art' && <ArtPanel />}
        {mode === 'events' && <EventsPanel />}
        {mode === 'chat' && <ChatPanel />}
        {mode === 'dm' && <DMPanel />}
        {mode === 'research' && <ResearchPanel />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.border,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 6,
    margin: 4,
  },
  tabActive: { backgroundColor: Colors.primaryFaint },
  tabLabel: { fontSize: 11, fontWeight: '500', color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary, fontWeight: '600' },
  content: { flex: 1 },

  // Art
  artPanel: { flex: 1, padding: 12 },
  artImage: { flex: 1, borderRadius: 10, backgroundColor: Colors.surfaceLight },
  artFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 },
  artTitle: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },

  // Chat
  chatPanel: { flex: 1 },
  panelTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, padding: 12, paddingBottom: 8 },
  chatScroll: { flex: 1 },
  chatContent: { paddingHorizontal: 12, gap: 10, paddingBottom: 10 },
  chatMsg: { gap: 2 },
  chatAuthor: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  chatText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 18 },
  chatTime: { fontSize: 10, color: Colors.textMuted },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  chatInput: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.textPrimary },
  chatSendBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  // DM
  dmPanel: { flex: 1 },
  dmItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  dmAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  dmInitial: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  dmContent: { flex: 1, gap: 2 },
  dmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dmName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  dmTime: { fontSize: 11, color: Colors.textMuted },
  dmLast: { fontSize: 12, color: Colors.textMuted },

  // Research
  researchPanel: { flex: 1, padding: 12, gap: 8 },
  researchSub: { fontSize: 12, color: Colors.textMuted },
  researchInputRow: { flexDirection: 'row', gap: 8 },
  researchInput: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: Colors.textPrimary },
  researchBtn: { width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  researchResults: { flex: 1 },
  resultCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.sm, padding: 12, marginBottom: 8 },
  resultText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },
  researchEmpty: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingTop: 40 },

  // Wallet
  walletPanel: { flex: 1 },
  walletBalance: { alignItems: 'center', paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  walletLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 2, textTransform: 'uppercase' },
  walletAmount: { fontSize: 36, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 },
  walletSub: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  walletInviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 12, marginTop: 12, paddingVertical: 10, borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  walletInviteBtnDisabled: { backgroundColor: Colors.surfaceLight },
  walletInviteText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  walletEarnSection: { paddingHorizontal: 12, paddingTop: 16, gap: 6 },
  walletEarnTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  walletEarnRow: { flexDirection: 'row', justifyContent: 'space-between' },
  walletEarnLabel: { fontSize: 12, color: Colors.textSecondary },
  walletEarnAmt: { fontSize: 12, fontWeight: '600', color: Colors.agree },
  walletTxList: { flex: 1, paddingHorizontal: 12, paddingTop: 16 },
  walletTxTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  walletTxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  walletTxLabel: { fontSize: 12, fontWeight: '500', color: Colors.textPrimary },
  walletTxNote: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  walletTxAmt: { fontSize: 13, fontWeight: '700' },

  // Events
  eventsPanel: { flex: 1 },
  eventCard: { flexDirection: 'row', gap: 10, backgroundColor: Colors.surfaceLight, borderRadius: Radius.sm, padding: 10, borderWidth: 1, borderColor: Colors.border },
  eventDate: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  eventDateText: { fontSize: 11, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  eventInfo: { flex: 1, gap: 2 },
  eventTitle: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  eventMeta: { fontSize: 11, color: Colors.textSecondary },
  eventGoing: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
});
