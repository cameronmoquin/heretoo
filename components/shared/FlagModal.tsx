import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Button } from './Button';
import { showAlert } from '../../lib/alert';
import { useFlagContent } from '../../hooks/useModeration';
import { FLAG_REASONS, type FlagReason, type ContentType } from '../../lib/moderation';

interface FlagModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: ContentType;
  contentId: string;
}

export function FlagModal({
  visible,
  onClose,
  contentType,
  contentId,
}: FlagModalProps) {
  const [selectedReason, setSelectedReason] = useState<FlagReason | null>(null);
  const [description, setDescription] = useState('');
  const flag = useFlagContent();

  const handleSubmit = () => {
    if (!selectedReason) return;

    flag.mutate(
      {
        contentType,
        contentId,
        reason: selectedReason,
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          showAlert(
            'Reported',
            'Thank you. This will be reviewed by community members from multiple perspectives.'
          );
          handleClose();
        },
        onError: (error) => {
          showAlert('Error', error.message);
        },
      }
    );
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Report Content</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Flags are reviewed by community members from at least 2 different
          clusters to prevent one group from silencing another.
        </Text>

        <ScrollView style={styles.reasons}>
          {FLAG_REASONS.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.reasonOption,
                selectedReason === value && styles.reasonOptionActive,
              ]}
              onPress={() => setSelectedReason(value)}
            >
              <Text
                style={[
                  styles.reasonText,
                  selectedReason === value && styles.reasonTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder="Additional details (optional)"
          placeholderTextColor={Colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />

        <Button
          title="Submit Report"
          onPress={handleSubmit}
          loading={flag.isPending}
          disabled={!selectedReason}
          size="lg"
          style={styles.submitButton}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
  },
  title: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 22,
    color: Colors.textPrimary,
  },
  cancel: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 20,
  },
  reasons: {
    flex: 1,
    marginBottom: 16,
  },
  reasonOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reasonOptionActive: {
    borderColor: Colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  reasonText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  reasonTextActive: {
    color: Colors.error,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitButton: {
    width: '100%',
    backgroundColor: Colors.error,
    marginBottom: 20,
  },
});
