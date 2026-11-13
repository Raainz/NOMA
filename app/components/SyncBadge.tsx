import React from 'react';
import { Text, View } from 'react-native';
import { Icon } from './Icons';
import { FONTS, NOMA_COLORS } from './UIComponents';
import { fr } from '../i18n/fr';
import { SyncStatus } from '../sync/syncQueue';

const CONFIG: Record<SyncStatus, { label: string; icon: 'check' | 'wifi-off' | 'alert'; color: string }> = {
  synced: { label: fr.sync.synced, icon: 'check', color: NOMA_COLORS.seaGreen },
  pending: { label: fr.sync.pending, icon: 'wifi-off', color: NOMA_COLORS.textSecondary },
  failed: { label: fr.sync.failed, icon: 'alert', color: NOMA_COLORS.danger },
};

/** Sync state of one activity: icon AND text (never colour alone). */
export const SyncBadge: React.FC<{ status: SyncStatus }> = ({ status }) => {
  const c = CONFIG[status];
  return (
    <View accessible accessibilityLabel={`Synchronisation : ${c.label}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Icon name={c.icon} size={14} color={c.color} />
      <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: c.color, marginLeft: 4 }}>{c.label}</Text>
    </View>
  );
};
