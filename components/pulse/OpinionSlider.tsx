import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '../../constants/colors';
import type { PulseStatement, VoteType } from '../../stores/pulseStore';

interface OpinionSliderProps {
  statement: PulseStatement;
  onVote: (vote: VoteType) => void;
  hasVoted: boolean;
}

export function OpinionSlider({ statement, onVote, hasVoted }: OpinionSliderProps) {
  const translateX = useSharedValue(0);

  const totalVotes = statement.agree_count + statement.disagree_count + statement.pass_count;
  const agreePercent = totalVotes > 0 ? Math.round((statement.agree_count / totalVotes) * 100) : 0;

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > 100) {
        runOnJS(onVote)('agree');
      } else if (e.translationX < -100) {
        runOnJS(onVote)('disagree');
      }
      translateX.value = withSpring(0);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Swipe hints */}
      <View style={styles.hints}>
        <Text style={[styles.hintText, { color: Colors.disagree }]}>Disagree</Text>
        <Text style={[styles.hintText, { color: Colors.agree }]}>Agree</Text>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.statementText}>{statement.text}</Text>

          {hasVoted && (
            <View style={styles.results}>
              <View style={styles.resultBar}>
                <View
                  style={[
                    styles.resultFill,
                    {
                      width: `${agreePercent}%`,
                      backgroundColor: Colors.agree,
                    },
                  ]}
                />
              </View>
              <View style={styles.resultLabels}>
                <Text style={styles.resultText}>
                  {agreePercent}% agree
                </Text>
                <Text style={styles.resultText}>
                  {totalVotes} votes
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Quick buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.voteButton, { borderColor: Colors.disagree }]}
          onPress={() => onVote('disagree')}
        >
          <Text style={[styles.voteButtonText, { color: Colors.disagree }]}>
            Disagree
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.voteButton, { borderColor: Colors.textMuted }]}
          onPress={() => onVote('pass')}
        >
          <Text style={[styles.voteButtonText, { color: Colors.textMuted }]}>
            Pass
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.voteButton, { borderColor: Colors.agree }]}
          onPress={() => onVote('agree')}
        >
          <Text style={[styles.voteButtonText, { color: Colors.agree }]}>
            Agree
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  hints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  hintText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.5,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 0.5,
    borderColor: Colors.border,
    minHeight: 160,
    justifyContent: 'center',
  },
  statementText: {
    fontSize: 18,
    color: Colors.textPrimary,
    lineHeight: 26,
    textAlign: 'center',
  },
  results: {
    marginTop: 20,
    gap: 8,
  },
  resultBar: {
    height: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  resultFill: {
    height: '100%',
    borderRadius: 3,
  },
  resultLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  voteButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
